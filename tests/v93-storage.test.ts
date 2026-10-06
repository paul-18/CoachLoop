import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { defaultState } from "../app/domain/training-types";
import { loadTrainingState, listSnapshots, loadSnapshot, loadAllSnapshots, saveSnapshot, resetTrainingData } from "../app/persistence/training-storage";
import { readRecoveryData } from "../app/persistence/recovery-export";
Object.defineProperty(globalThis, "indexedDB", { value: new IDBFactory(), configurable: true });

test("v3 to v4 upgrades keep the log and checkpoints, backfill metadata, and prune both stores atomically", async () => {
  const state = defaultState(); state.goals = ["Retain during upgrade"];
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("coach-loop", 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("app").put(state, "training-state");
      const store = db.createObjectStore("snapshots", { keyPath: "id" });
      store.put({ id: "legacy-copy", createdAt: "2026-10-04T12:00:00Z", reason: "before-restore", state });
      db.createObjectStore("sync"); db.createObjectStore("device");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
  assert.deepEqual((await loadTrainingState())?.goals, state.goals);
  const metadata = await listSnapshots();
  assert.equal(metadata.length, 1); assert.equal(metadata[0].id, "legacy-copy");
  assert.equal("state" in metadata[0], false);
  assert.deepEqual((await loadSnapshot(metadata[0].id))?.state.goals, state.goals);
  assert.deepEqual((await readRecoveryData()).recoveryCopies[0].state.goals, state.goals);
  for (let i = 0; i < 8; i++) await saveSnapshot(state, "workout-complete");
  assert.equal((await listSnapshots()).length, 6); // five routine plus preserved checkpoint
  assert.deepEqual((await listSnapshots()).map(copy => copy.id).sort(), (await loadAllSnapshots()).map(copy => copy.id).sort());
  const before = await listSnapshots(), add = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function(...args: Parameters<typeof add>) {
    if (this.name === "snapshot-meta") throw new Error("Simulated metadata failure");
    return add.apply(this, args);
  };
  try { await assert.rejects(saveSnapshot(state, "before-restore"), /metadata failure/); }
  finally { IDBObjectStore.prototype.add = add; }
  assert.deepEqual(await listSnapshots(), before);
  assert.equal((await loadAllSnapshots()).length, before.length);
  await resetTrainingData(defaultState());
  assert.equal((await listSnapshots()).length, 0); assert.equal((await loadAllSnapshots()).length, 0);
});
