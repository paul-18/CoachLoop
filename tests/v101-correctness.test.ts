import test from "node:test";
import assert from "node:assert/strict";
import { nextOpenBlock, workoutCompletionSummary, workoutProgressCopy } from "../app/domain/completion";
import { defaultState, makeSet, makeWorkout } from "../app/domain/training-types";
import { finishWorkoutState } from "../app/domain/workout-transitions";
import { exampleFitlog, parseFitlog } from "../app/interchange/fitlog";
import { summarizeWorkout } from "../app/views/shared";
import { blankStartState } from "../app/views/starter-plan";
import { completedSetValues } from "../app/domain/training-metrics";

test("the workout header and finish dialog count the same sets and activities", () => {
  const workout = parseFitlog(exampleFitlog(), "lb", {});
  workout.exercises[0].sets[1].completed = true;
  workout.exercises[0].sets[2].completed = true;
  assert.equal(workoutProgressCopy(workout), "2/8 sets · 0/2 activities");
  assert.equal(workoutCompletionSummary(workout), "2/8 sets · 0/2 activities complete.");
});

test("history counts only exercises that have a completed set", () => {
  const workout = parseFitlog(exampleFitlog(), "lb", {});
  workout.exercises[0].sets[1].completed = true;
  workout.exercises[0].sets[1].actualReps = "5";
  assert.equal(summarizeWorkout(workout), "1 exercise · 1 completed set");
});

test("a skipped activity is not offered as the next rest target", () => {
  const workout = parseFitlog(exampleFitlog(), "lb", {});
  workout.cardio[0].skipped = true;
  const next = nextOpenBlock(workout);
  assert.equal(next?.type, "exercise");
  if (next?.type === "exercise") assert.equal(next.exercise.name, "Barbell Bench Press");
});

test("a blank log gets the first-workout note for a working set, not an empty warm-up", () => {
  const blank = blankStartState(defaultState());
  const warmup = makeWorkout("lb", 40);
  warmup.id = "warmup-only";
  warmup.status = "active";
  warmup.exercises[0].sets = [makeSet("lb", { completed: true, warmup: true, actualReps: "5", actualWeight: 45, plannedWeight: 45 })];
  assert.equal(finishWorkoutState({ ...blank, workouts: [warmup] }, warmup).settings.firstWorkoutNote, undefined);
  const real = makeWorkout("lb", 50);
  real.id = "working-set";
  real.status = "active";
  real.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5", actualWeight: 135, plannedWeight: 135 })];
  assert.equal(finishWorkoutState({ ...blank, workouts: [real] }, real).settings.firstWorkoutNote, "show");
});

test("checking a set without typing still logs the suggested value", () => {
  const set = makeSet("lb", { plannedReps: "5", plannedWeight: 135, actualReps: "", actualWeight: null, loadType: "weighted" });
  const accepted = completedSetValues(set);
  assert.equal(accepted.actualReps, "5");
  assert.equal(accepted.actualWeight, 135);
  assert.equal(accepted.completedAsPlanned, true);
});

test("mobility names keep their meaning and a long dash string does not stall", () => {
  const normal = parseFitlog("[FITLOG:1]\nWORKOUT|Move|2026-01-15\nMOBILITY|Stretch\nINTERVALS|Hip flexor stretch — 30 sec/side\n[/FITLOG]", "lb", {});
  assert.equal(normal.cardio[0]?.mobilityMoves[0]?.name, "Hip flexor stretch");
  assert.match(normal.cardio[0]?.mobilityMoves[0]?.prescription ?? "", /30 sec/);
  const started = performance.now();
  const long = parseFitlog(`[FITLOG:1]\nWORKOUT|Move|2026-01-15\nMOBILITY|Stretch\nINTERVALS|${"-".repeat(32000)}\n[/FITLOG]`, "lb", {});
  assert.ok(performance.now() - started < 1000, "a 32,000-character dash string should stay well under a second");
  assert.equal(long.cardio[0]?.mobilityMoves[0]?.name, "Movement");
});
