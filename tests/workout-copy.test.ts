import test from "node:test";
import assert from "node:assert/strict";
import { makeWorkout, makeCardio, makeSet } from "../app/domain/training-types";
import { repeatWorkoutDraft, replanWorkoutDraft } from "../app/domain/workout-copy";
import { workoutLiftingVolume } from "../app/domain/training-metrics";

test("repeat uses logged results as new targets without transferring history or volume", () => {
  const original = makeWorkout("lb", 120, "Existing session");
  original.status = "completed"; original.completedAt = "2026-09-01T12:00:00.000Z"; original.date = "2026-09-01";
  original.originKey = "old-import"; original.notes = "Old athlete notes";
  original.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5", actualWeight: 100, loadType: "weighted", plannedReps: "8", plannedWeight: 90 })];
  original.cardio = [{ ...makeCardio("run"), completed: true, actualDurationMin: 25, actualDistanceKm: 5 }];
  original.blockOrder = [{ type: "activity", id: original.cardio[0].id }, { type: "exercise", id: original.exercises[0].id }];
  const before = structuredClone(original), copy = repeatWorkoutDraft(original);
  assert.deepEqual(original, before);
  assert.notEqual(copy.id, original.id); assert.notEqual(copy.exercises[0].id, original.exercises[0].id);
  assert.notEqual(copy.exercises[0].sets[0].id, original.exercises[0].sets[0].id);
  assert.equal(copy.exercises[0].sets[0].plannedWeight, 100); assert.equal(copy.exercises[0].sets[0].plannedReps, "5");
  assert.equal(copy.exercises[0].sets[0].actualWeight, null); assert.equal(copy.exercises[0].sets[0].completed, false);
  assert.equal(copy.cardio[0].plannedDistanceKm, 5); assert.equal(copy.cardio[0].actualDistanceKm, null);
  assert.equal(copy.cardio[0].completed, false); assert.equal(copy.completedAt, null); assert.equal(copy.originKey, undefined);
  assert.equal(copy.blockOrder[0].id, copy.cardio[0].id); assert.equal(copy.blockOrder[1].id, copy.exercises[0].id);
  assert.equal(workoutLiftingVolume(copy, "lb").volume, 0);
});

test("replan copies a skipped prescription into an uncompleted queue item, preserving original date and targets", () => {
  const original = makeWorkout("lb", 120, "Skipped session");
  original.status = "skipped"; original.date = "2026-09-01"; original.skipReason = "Schedule changed";
  original.skippedAt = "2026-09-01T12:00:00.000Z";
  original.exercises[0].sets = [makeSet("lb", { plannedReps: "6-8", plannedWeight: 100, actualReps: "3", actualWeight: 90, completed: true })];
  const before = structuredClone(original), copy = replanWorkoutDraft(original);
  assert.deepEqual(original, before); assert.equal(original.date, "2026-09-01");
  assert.notEqual(copy.id, original.id); assert.equal(copy.status, "planned"); assert.equal(copy.startedAt, null);
  assert.equal(copy.skipReason, ""); assert.equal(copy.skippedAt, null);
  assert.equal(copy.exercises[0].sets[0].plannedReps, "6-8"); assert.equal(copy.exercises[0].sets[0].plannedWeight, 100);
  assert.equal(copy.exercises[0].sets[0].actualReps, ""); assert.equal(copy.exercises[0].sets[0].completed, false);
  assert.equal(workoutLiftingVolume(copy, "lb").volume, 0);
});
