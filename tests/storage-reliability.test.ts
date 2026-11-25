import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBObjectStore } from "fake-indexeddb";
import { defaultState } from "../app/domain/training-types";
import { saveTrainingState, loadTrainingState, saveSnapshot, listSnapshots, resetTrainingData, retryQueuedState } from "../app/persistence/training-storage";
Object.defineProperty(globalThis, "indexedDB", { value: indexedDB, configurable: true });
test("queued writes coalesce to the latest log; quota failures reject and a retry commits", async () => {
  const a=defaultState(), b=defaultState(), c=defaultState();a.goals=["first"];b.goals=["second"];c.goals=["latest"];
  await Promise.all([saveTrainingState(a),saveTrainingState(b),saveTrainingState(c)]);
  assert.deepEqual((await loadTrainingState())?.goals,["latest"]);
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(){throw new DOMException("QC simulated quota failure", "QuotaExceededError");};
  try { await assert.rejects(saveTrainingState(a),/quota failure/); } finally { IDBObjectStore.prototype.put=put; }
  assert.deepEqual((await loadTrainingState())?.goals,["latest"]);
  await saveTrainingState(b);assert.deepEqual((await loadTrainingState())?.goals,["second"]);
});
test("failed erase rolls back the saved log and recovery copies; explicit erase clears both", async () => {
  const state=defaultState();state.goals=["keep"];await saveTrainingState(state);await saveSnapshot(state,"QC");
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new Error("QC erase failure");};
  try {await assert.rejects(resetTrainingData(defaultState()),/erase failure/);}finally{IDBObjectStore.prototype.put=put;}
  assert.deepEqual((await loadTrainingState())?.goals,["keep"]);assert.equal((await listSnapshots()).length,1);
  await resetTrainingData(defaultState());assert.equal((await listSnapshots()).length,0);assert.deepEqual((await loadTrainingState())?.goals,[]);
});

test("a newer queued state survives a failed transaction and can be explicitly retried", async () => {
  const originalPut = IDBObjectStore.prototype.put;
  const first = defaultState(), newer = defaultState();
  first.goals = ["in-flight"];
  newer.goals = ["newer queued edit"];
  let started!: () => void;
  const transactionStarted = new Promise<void>(resolve => { started = resolve; });
  let aborted = false;
  IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
    const request = originalPut.call(this, value, key);
    if (!aborted) {
      aborted = true;
      started();
      const transaction = this.transaction;
      setTimeout(() => { try { transaction.abort(); } catch { /* Already settled. */ } }, 0);
    }
    return request;
  };
  try {
    const firstSave = saveTrainingState(first);
    await transactionStarted;
    const newerSave = saveTrainingState(newer);
    await assert.rejects(firstSave);
    await assert.rejects(newerSave);
  } finally { IDBObjectStore.prototype.put = originalPut; }
  await retryQueuedState();
  assert.deepEqual((await loadTrainingState())?.goals, ["newer queued edit"]);
});
