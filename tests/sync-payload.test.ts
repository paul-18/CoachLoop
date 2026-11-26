import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeWorkout } from "../app/domain/training-types";
import { portableBackup } from "../app/persistence/portable-backup";
import { mergeRestoredState } from "../app/persistence/cloud-sync";

test("portable backup retains a visible unresolved set correction across restore", () => {
  const canonical = defaultState();
  const workout = makeWorkout("lb", 120);
  const exercise = workout.exercises[0], set = exercise.sets[0];
  set.actualWeight = 185;
  canonical.workouts = [workout];
  canonical.pendingConflicts = [{ id: "conflict", recordId: workout.id, fieldPath: `/workouts/${workout.id}/exercises/${exercise.id}/sets/${set.id}/actualWeight`, base: 175, remoteValue: 185, raisingDeviceValue: 205, raisingDeviceId: "phone", createdAt: new Date().toISOString() }];
  const displayed = structuredClone(canonical);
  displayed.workouts[0].exercises[0].sets[0].actualWeight = 205;
  const backup = portableBackup(canonical, displayed);
  assert.equal(backup.workouts[0].exercises[0].sets[0].actualWeight, 205);
  assert.equal(backup.pendingConflicts?.length, 0);
  assert.equal(mergeRestoredState(canonical, backup).workouts[0].exercises[0].sets[0].actualWeight, 205);
});

test("sync merge compacts tombstone lists so they cannot grow unbounded", () => {
  const local = defaultState(), remote = defaultState();
  local.deletedWorkoutIds = Array.from({ length: 600 }, (_, i) => `old-${i}`);
  remote.deletedWorkoutIds = ["new-1"];
  const merged = mergeRestoredState(local, remote);
  assert.equal(merged.deletedWorkoutIds?.length, 500);
  assert.equal(merged.deletedWorkoutIds?.includes("new-1"), true);
  assert.equal(merged.deletedWorkoutIds?.includes("old-0"), false);

  const workout = makeWorkout("lb", 120);
  const copy = structuredClone(workout);
  copy.exercises[0].deletedSetIds = Array.from({ length: 600 }, (_, i) => `set-${i}`);
  local.workouts = [structuredClone(workout)];
  remote.workouts = [copy];
  const mergedSets = mergeRestoredState(local, remote);
  assert.equal(mergedSets.workouts[0].exercises[0].deletedSetIds?.length, 500);
});

test("sync merge retains set tombstones and compares offset timestamps by epoch", () => {
  const local = defaultState(), remote = defaultState();
  const workout = makeWorkout("lb", 120);
  const localCopy = structuredClone(workout), remoteCopy = structuredClone(workout);
  const localExercise = localCopy.exercises[0], remoteExercise = remoteCopy.exercises[0];
  const deleted = localExercise.sets[0];
  const kept = localExercise.sets[1];
  localExercise.deletedSetIds = [deleted.id];
  localExercise.updatedAt = "2025-01-01T00:00:00-05:00";
  remoteExercise.updatedAt = "2025-01-01T04:30:00Z";
  const localSet = localExercise.sets[1];
  const remoteSet = remoteExercise.sets[1];
  localSet.actualReps = "5";
  localSet.updatedAt = "2025-01-01T00:00:00-05:00";
  remoteSet.actualReps = "99";
  remoteSet.updatedAt = "2025-01-01T04:30:00Z";
  localCopy.updatedAt = remoteCopy.updatedAt = "2025-01-01T00:00:00Z";
  local.workouts = [localCopy];
  remote.workouts = [remoteCopy];
  const merged = mergeRestoredState(local, remote);
  const sets = merged.workouts[0].exercises[0].sets;
  assert.equal(sets.some(set => set.id === deleted.id), false);
  assert.equal(sets.find(set => set.id === kept.id)?.actualReps, "5");
});

test("sync merge orders benchmark attempts by instant, not ISO string", () => {
  const local = defaultState(), remote = defaultState();
  const benchmark = {
    id: "bench-5k",
    name: "5K time trial",
    protocol: "flat out",
    result: "24:30",
    testedOn: "2026-11-20",
    retestDays: 90,
    updatedAt: "2026-11-20T09:00:00Z",
    attempts: [
      { id: "attempt-a", date: "2026-11-20", result: "24:30", protocol: "flat out", updatedAt: "2026-11-20T10:00:00+02:00" },
    ],
  };
  const remoteBenchmark = {
    ...benchmark,
    result: "23:40",
    updatedAt: "2026-11-20T09:30:00Z",
    attempts: [
      { id: "attempt-b", date: "2026-11-20", result: "23:50", protocol: "flat out", updatedAt: "2026-11-20T09:00:00Z" },
      { id: "attempt-c", date: "2026-11-20", result: "23:40", protocol: "flat out", updatedAt: "2026-11-20T09:00:00Z" },
    ],
  };
  local.benchmarks = [benchmark];
  remote.benchmarks = [remoteBenchmark];
  const merged = mergeRestoredState(local, remote);
  const attempts = merged.benchmarks?.[0].attempts ?? [];
  // As strings "10:00:00+02:00" > "09:00:00Z", but as instants 08:00Z < 09:00Z;
  // attempt-b and attempt-c share an instant, so the id breaks the tie.
  assert.deepEqual(attempts.map((attempt) => attempt.id), ["attempt-a", "attempt-b", "attempt-c"]);
  assert.equal(merged.benchmarks?.[0].result, "23:40");
  assert.equal(merged.benchmarks?.[0].testedOn, "2026-11-20");
});
