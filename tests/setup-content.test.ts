import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeSet, makeWorkout } from "../app/domain/training-types";
import { validateSyncedState } from "../app/persistence/training-validation";
import {
  makeGoalTarget,
  mergeGoalTargets,
  oneThingToday,
  personalRecordMessage,
  presetById,
  presetProgress,
  stampNewTarget,
  targetProgress,
} from "../app/domain/setup-content";

const benchPreset = presetById("bench-225")!;

function stateWithBenchSet(weight: number, reps: string): ReturnType<typeof defaultState> {
  const state = defaultState();
  const workout = makeWorkout("lb", 0, "History");
  workout.status = "completed";
  workout.exercises[0].name = "Barbell Bench Press";
  workout.exercises[0].sets = [makeSet("lb", { plannedReps: reps, plannedWeight: weight, actualReps: reps, actualWeight: weight, loadType: "weighted", weightMode: "total", completed: true })];
  state.workouts = [workout];
  return state;
}

test("structured targets report e1rm progress without inventing evidence", () => {
  const target = makeGoalTarget(benchPreset);
  const none = targetProgress(defaultState(), target);
  assert.equal(none.done, false);
  assert.match(none.detail, /No eligible estimate/);
  const state = stateWithBenchSet(185, "5");
  const progress = targetProgress(state, target);
  assert.equal(progress.done, false);
  assert.ok(progress.ratio > 0 && progress.ratio < 1);
  assert.match(progress.detail, /Best estimate/);
  assert.match(progress.detail, /% of 225 lb/);
});

test("e1rm targets honor target reps via estimated-one-rep-max normalization", () => {
  const preset = { ...benchPreset, id: "bench-225x5", targetReps: 5 };
  const target = makeGoalTarget(preset);
  // 200x5 estimates above 225x1, so this state achieves a 225x5 target but not 225x1... check the math:
  // e1RM(200,5) vs e1RM(225,5): 200x5 must estimate below 225x5.
  const state = stateWithBenchSet(200, "5");
  const progress = targetProgress(state, target);
  assert.equal(progress.done, false);
  assert.ok(progress.ratio > 0 && progress.ratio < 1);
});

test("achieving a target is detected and stamped retroactively at creation", () => {
  const state = stateWithBenchSet(225, "1");
  const stamped = stampNewTarget(state, makeGoalTarget(benchPreset));
  assert.ok(stamped.achievedAt, "retroactive achievement is stamped");
  assert.equal(targetProgress(state, stamped).done, true);
  const fresh = stampNewTarget(defaultState(), makeGoalTarget(benchPreset));
  assert.equal(fresh.achievedAt, null, "no false achievement without evidence");
});

test("editing a target's label never breaks tracking (no text matching)", () => {
  const state = stateWithBenchSet(185, "5");
  const target = { ...makeGoalTarget(benchPreset), label: "my totally renamed bench goal!!!" };
  const progress = targetProgress(state, target);
  assert.ok(progress.ratio > 0, "progress still measured after arbitrary label edit");
  assert.equal(progress.label, "my totally renamed bench goal!!!");
});

test("reps targets measure best single-set reps", () => {
  const preset = presetById("pullups-10")!;
  const state = defaultState();
  const workout = makeWorkout("lb", 0, "History");
  workout.status = "completed";
  workout.exercises[0].name = "Pull-Up";
  workout.exercises[0].sets = [
    makeSet("lb", { actualReps: "6", loadType: "bodyweight", completed: true }),
    makeSet("lb", { actualReps: "8", loadType: "bodyweight", completed: true }),
  ];
  state.workouts = [workout];
  const target = makeGoalTarget(preset);
  const progress = targetProgress(state, target);
  assert.equal(progress.done, false);
  assert.ok(progress.ratio > 0 && progress.ratio < 1);
  assert.match(progress.detail, /Best set 8 of 10/);
});

test("consistency targets measure trailing weeks and total counts", () => {
  const perWeek = presetById("train-3x8")!;
  const state = defaultState();
  assert.equal(targetProgress(state, makeGoalTarget(perWeek)).ratio, 0);
  const total = presetById("log-50")!;
  const progress = targetProgress(state, makeGoalTarget(total));
  assert.equal(progress.done, false);
  assert.match(progress.detail, /0 of 50 workouts/);
});

test("distance and race targets read logged runs", () => {
  const state = defaultState();
  const done5k = targetProgress(state, makeGoalTarget(presetById("first-5k")!));
  assert.equal(done5k.done, false);
  assert.match(done5k.detail, /No completed run distance/);
});

test("oneThingToday surfaces the first unachieved structured target", () => {
  const state = stateWithBenchSet(185, "5");
  state.goalTargets = [stampNewTarget(state, makeGoalTarget(benchPreset)), stampNewTarget(state, makeGoalTarget(presetById("squat-315")!))];
  const thing = oneThingToday(state);
  assert.equal(thing?.label, "Bench 225");
  const achieved = stateWithBenchSet(225, "1");
  achieved.goalTargets = [stampNewTarget(achieved, makeGoalTarget(benchPreset)), stampNewTarget(achieved, makeGoalTarget(presetById("squat-315")!))];
  assert.equal(oneThingToday(achieved)?.label, "Squat 315");
  assert.equal(oneThingToday(defaultState()), null);
});

test("goal targets survive the save/load validation boundary (no silent stripping)", () => {
  const state = defaultState();
  state.goalTargets = [stampNewTarget(state, makeGoalTarget(benchPreset))];
  const roundTripped = validateSyncedState(JSON.parse(JSON.stringify(state)));
  assert.equal(roundTripped.goalTargets?.length, 1);
  assert.equal(roundTripped.goalTargets?.[0].presetId, "bench-225");
  assert.equal(roundTripped.goalTargets?.[0].targetWeight, 225);
  // Legacy states without the field still validate.
  const legacy = validateSyncedState(JSON.parse(JSON.stringify(defaultState())));
  assert.equal(legacy.goalTargets, undefined);
});

test("mergeGoalTargets dedupes by preset", () => {
  const a = makeGoalTarget(benchPreset);
  const merged = mergeGoalTargets([a], [makeGoalTarget(benchPreset), makeGoalTarget(presetById("squat-315")!)]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(t => t.presetId), ["bench-225", "squat-315"]);
});

test("preset drafts show live progress without being saved", () => {
  const state = stateWithBenchSet(185, "5");
  const draft = presetProgress(state, benchPreset);
  assert.ok(draft.ratio > 0 && draft.ratio < 1);
});

test("logging a set that reaches a target names it in the PR message", () => {
  const state = stateWithBenchSet(185, "5");
  state.goalTargets = [makeGoalTarget(benchPreset)];
  const message = personalRecordMessage(state, "Barbell Bench Press", makeSet("lb", { actualReps: "3", actualWeight: 220, loadType: "weighted", weightMode: "total", completed: true }));
  assert.ok(message, "expected a PR message");
  assert.match(message!, /That reaches Bench 225/);
  const warmup = personalRecordMessage(state, "Barbell Bench Press", makeSet("lb", { actualReps: "3", actualWeight: 220, loadType: "weighted", weightMode: "total", completed: true, warmup: true }));
  assert.equal(warmup, null);
});
