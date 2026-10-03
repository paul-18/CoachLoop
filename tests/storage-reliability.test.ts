import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBObjectStore } from "fake-indexeddb";
import { defaultState } from "../app/domain/training-types";
import { saveTrainingState, loadTrainingState, saveSnapshot, listSnapshots, resetTrainingData } from "../app/persistence/training-storage";
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
