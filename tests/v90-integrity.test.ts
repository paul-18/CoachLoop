import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { syntheticHistory } from "../scripts/qc-history-data";
import { validateSyncedState, validatedState, validateStateEdit, type ValidatedState } from "../app/persistence/training-validation";
import { verifyBackup } from "../app/persistence/backup-verification";
import { saveValidatedState, loadTrainingState } from "../app/persistence/training-storage";
import { serializeBackup } from "../app/persistence/backup-tools";

test("routine validation reuses only immutable admitted workouts and fully validates changed records", () => {
  const current = validatedState(syntheticHistory(100));
  const workout = current.workouts[0];
  const candidate = { ...current, workouts: [{ ...workout, notes: "Corrected" }, ...current.workouts.slice(1)] };
  const checked = validateStateEdit(current, candidate);
  assert.deepEqual(checked, validateSyncedState(candidate));
  assert.equal(checked.workouts[1], current.workouts[1]);
  assert.notEqual(checked.workouts[0], current.workouts[0]);
  assert.ok(Object.isFrozen(checked.workouts[0].exercises[0].sets[0]));
  assert.throws(() => { checked.workouts[1].exercises[0].sets[0].actualReps = "corrupt"; }, TypeError);
  assert.throws(() => { checked.workouts.push(workout); }, TypeError);
  candidate.workouts[0].notes = "Caller changes their draft";
  assert.equal(checked.workouts[0].notes, "Corrected");
  const forged = structuredClone(current) as ValidatedState;
  assert.throws(() => validateStateEdit(forged, candidate), /validated immutable/);
  assert.throws(() => saveValidatedState(forged), /validated immutable/);
});

test("incremental edits retain v89 tombstone, ID, reference, numeric and settings protections", () => {
  const current = validatedState(syntheticHistory(3));
  const invalid = [
    (s: ReturnType<typeof syntheticHistory>) => { s.workouts[0].exercises[0].sets[0].actualWeight = Infinity; },
    (s: ReturnType<typeof syntheticHistory>) => { s.workouts[0].exercises[0].sets[0].skipped = true; },
    (s: ReturnType<typeof syntheticHistory>) => { s.workouts[0].deletedExerciseIds = [s.workouts[0].exercises[0].id]; },
    (s: ReturnType<typeof syntheticHistory>) => { s.deletedWorkoutIds = [s.workouts[1].id]; },
    (s: ReturnType<typeof syntheticHistory>) => { s.workouts[0].blockOrder[0].id = "missing"; },
    (s: ReturnType<typeof syntheticHistory>) => { s.workouts[0].exercises[0].sets.push(s.workouts[0].exercises[0].sets[0]); },
    (s: ReturnType<typeof syntheticHistory>) => { s.workouts.push(s.workouts[0]); },
    (s: ReturnType<typeof syntheticHistory>) => { s.settings.defaultRestSec = -1; },
    (s: ReturnType<typeof syntheticHistory>) => { s.activeWorkoutId = s.workouts[0].id; },
    (s: ReturnType<typeof syntheticHistory>) => { s.workouts[0].date = "2026-02-30"; },
  ];
  for (const corrupt of invalid) {
    const candidate = structuredClone(current); corrupt(candidate);
    assert.throws(() => validateStateEdit(current, candidate));
    assert.throws(() => validateSyncedState(candidate));
  }
  // A reused workout still participates in cross-workout checks.
  assert.throws(() => validateStateEdit(current, { ...current, deletedWorkoutIds: [current.workouts[2].id] }));
});

test("read-only verification reports dates and counts, rejects corrupt/newer files, and never writes the log", async () => {
  Object.assign(globalThis, { indexedDB, IDBKeyRange });
  const current = validatedState(syntheticHistory(1));
  await saveValidatedState(current);
  const backup = syntheticHistory(3);
  const info = verifyBackup(serializeBackup(backup));
  assert.equal(info.workouts, 3); assert.equal(info.sets, 36); assert.equal(info.completed, 3);
  assert.equal(info.firstDate, "2026-10-02"); assert.equal(info.lastDate, "2026-10-04");
  assert.equal(info.profilePresent, true); assert.equal(info.goals, 1);
  assert.throws(() => verifyBackup('{"version":1'), /incomplete or corrupt/);
  assert.throws(() => verifyBackup('{"version":99}'), /different or newer/);
  assert.throws(() => verifyBackup('{"not":"a backup"}'), /Coach Loop JSON/);
  assert.deepEqual(await loadTrainingState(), current);
});

test("immutable internal saves preserve coalescing, caller isolation, and final committed values", async () => {
  Object.assign(globalThis, { indexedDB, IDBKeyRange });
  const current = validatedState(syntheticHistory(5));
  const a = validateStateEdit(current, { ...current, goals: ["First edit"] });
  const b = validateStateEdit(a, { ...a, goals: ["Newest edit"] });
  await Promise.all([saveValidatedState(a), saveValidatedState(b)]);
  const durable = await loadTrainingState();
  assert.deepEqual(durable?.goals, ["Newest edit"]);
  assert.equal(durable?.workouts.length, 5);
  assert.deepEqual(durable, b);
});
