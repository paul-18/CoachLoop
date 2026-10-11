import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { roundedMeasure } from "../app/domain/completion";
import { repeatWorkoutDraft } from "../app/domain/workout-copy";
import { coverageForLastDays, exerciseMappingEntries, exerciseNamesNeedingCoverage } from "../app/domain/training-coverage";
import { defaultState, makeCardio, makeSet, makeWorkout } from "../app/domain/training-types";
import { listSnapshots, loadSnapshot, resetTrainingData, saveSnapshot, saveTrainingState } from "../app/persistence/training-storage";

Object.defineProperty(globalThis, "indexedDB", { value: indexedDB, configurable: true });

test("repeating a workout stores rounded plan targets instead of float tails", () => {
  const original = makeWorkout("lb", 60, "Sled");
  original.status = "completed";
  original.completedAt = "2026-10-10T12:00:00.000Z";
  const activity = makeCardio("force", "Sled");
  activity.completed = true;
  activity.efforts = [{
    id: "effort",
    plannedDistanceM: 100,
    actualDistanceM: 100,
    plannedDurationSec: 61,
    actualDurationSec: 61,
    plannedLoad: null,
    actualLoad: null,
    completed: true,
  }];
  original.cardio = [activity];
  original.exercises = [];
  original.blockOrder = [{ type: "activity", id: activity.id }];
  const copy = repeatWorkoutDraft(original);
  assert.equal(roundedMeasure(61 / 60), 1.02);
  assert.equal(copy.cardio[0].plannedDurationMin, 1.02);
  assert.equal(copy.cardio[0].plannedDistanceKm, 0.1);
  assert.doesNotMatch(String(copy.cardio[0].plannedDurationMin), /1666|0000/);
  assert.equal(copy.cardio[0].actualDurationMin, null);
});

test("an aliased exercise uses the canonical muscle target in review and coverage", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 90, "Push");
  workout.status = "completed";
  workout.date = "2026-10-10";
  workout.completedAt = "2026-10-10T12:00:00.000Z";
  workout.exercises[0].name = "bench";
  workout.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5", actualWeight: 135, loadType: "weighted" })];
  state.exerciseAliases = { bench: "Barbell Bench Press" };
  state.workouts = [workout];
  const entry = exerciseMappingEntries(state).find((item) => item.name === "bench");
  assert.ok(entry);
  assert.equal(entry.reviewed, false);
  assert.deepEqual(entry.target?.primary, ["Chest"]);
  assert.equal(exerciseNamesNeedingCoverage(state).includes("bench"), false);
  assert.ok(coverageForLastDays(state, 7, "2026-10-10").find((item) => item.muscle === "Chest")!.effectiveSets > 0);
});

test("erase keeps one before-reset copy and drops older recovery copies", async () => {
  const current = defaultState();
  current.goals = ["keep this log"];
  await saveTrainingState(current);
  await saveSnapshot(current, "QC");
  await saveSnapshot(current, "workout-complete");
  const cleared = defaultState();
  await resetTrainingData(cleared, undefined, current);
  const copies = await listSnapshots();
  assert.equal(copies.length, 1);
  assert.equal(copies[0].reason, "before-reset");
  assert.deepEqual((await loadSnapshot(copies[0].id))?.state.goals, ["keep this log"]);
  for (let index = 0; index < 6; index += 1) await saveSnapshot(cleared, "workout-complete");
  const retained = await listSnapshots();
  assert.equal(retained.filter((copy) => copy.reason === "before-reset").length, 1);
  assert.ok(retained.filter((copy) => copy.reason === "workout-complete").length <= 5);
});
