import assert from "node:assert/strict";
import test from "node:test";
import { makeExercise, makeSet } from "../app/domain/training-types";
import { insertExerciseSet } from "../app/domain/exercise-sets";

test("inserting after the final warm-up retains order and evidence, creating a fresh unfinished warm-up", () => {
  const exercise = makeExercise("kg", 90, "Dumbbell press");
  const warmup = makeSet("kg", { warmup: true, plannedReps: "8", plannedWeight: 10, loadType: "weighted", weightMode: "per_hand", completed: true, completedAsPlanned: true, actualReps: "8", actualWeight: 10, rpe: "5", notes: "Existing evidence" });
  const working = makeSet("kg", { plannedReps: "6-8", plannedWeight: 20, plannedRir: "2", loadType: "weighted" });
  exercise.sets = [warmup, working];
  const original = JSON.stringify(exercise), result = insertExerciseSet(exercise, warmup.id, "after"), inserted = result.sets[1];
  assert.deepEqual(result.sets.map(set => set.id), [warmup.id, inserted.id, working.id]);
  assert.equal(JSON.stringify(exercise), original);
  assert.equal(result.sets[0], warmup); assert.equal(result.sets[2], working);
  assert.equal(inserted.warmup, true); assert.equal(inserted.completed, false); assert.equal(inserted.completedAsPlanned, false);
  assert.equal(inserted.actualWeight, null); assert.equal(inserted.actualReps, ""); assert.equal(inserted.rpe, ""); assert.equal(inserted.notes, "");
  assert.equal(inserted.unit, "kg"); assert.equal(inserted.weightMode, "per_hand"); assert.equal(inserted.plannedWeight, 10);
  assert.ok(!exercise.sets.some(set => set.id === inserted.id));
});

test("inserting before the first or after the last set preserves surrounding IDs, tombstones and independent targets", () => {
  const exercise = makeExercise("lb", 60, "Pull-Up");
  const set = makeSet("lb", { loadType: "bodyweight", plannedReps: "6", plannedRpe: "7", warmup: false, skipped: true });
  exercise.sets = [set]; exercise.deletedSetIds = ["old-set"];
  const before = insertExerciseSet(exercise, set.id, "before"), after = insertExerciseSet(before, set.id, "after");
  assert.equal(after.sets[1], set); assert.equal(after.sets.length, 3);
  for (const newSet of [after.sets[0], after.sets[2]]) {
    assert.equal(newSet.skipped, undefined); assert.equal(newSet.warmup, false); assert.equal(newSet.loadType, "bodyweight");
    assert.equal(newSet.plannedRpe, "7"); assert.equal(newSet.completed, false);
  }
  assert.deepEqual(after.deletedSetIds, ["old-set"]);
  assert.throws(() => insertExerciseSet(exercise, "missing", "after"), /no longer exists/);
});
