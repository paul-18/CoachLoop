import test from "node:test";
import assert from "node:assert/strict";
import { decodeSyncPayload, encodeSyncPayload, MAX_STORED_BYTES } from "../app/persistence/sync-payload";
import { defaultState, makeWorkout } from "../app/domain/training-types";
import { portableBackup } from "../app/persistence/portable-backup";
import { mergeRestoredState } from "../app/persistence/cloud-sync";

test("large logs compress inside the existing D1 row and round-trip unchanged", async () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 120);
  state.workouts = Array.from({ length: 300 }, (_, i) => ({ ...workout, id: `qa-${i}`, name: `Session ${i} ${"Bench Squat Deadlift ".repeat(400)}` }));
  const raw = JSON.stringify(state);
  assert.ok(raw.length > MAX_STORED_BYTES);
  const encoded = await encodeSyncPayload(state);
  assert.ok(encoded.payload.startsWith("gzip:"));
  assert.ok(encoded.bytes < MAX_STORED_BYTES);
  assert.deepEqual(await decodeSyncPayload(encoded.payload), state);
  assert.deepEqual(await decodeSyncPayload(JSON.stringify(defaultState())), defaultState());
});

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
