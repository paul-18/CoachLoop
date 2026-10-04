import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB, IDBKeyRange, IDBObjectStore } from "fake-indexeddb";
import { defaultState } from "../app/domain/training-types";
import { validatedState } from "../app/persistence/training-validation";
import { saveValidatedState, loadTrainingState, resetTrainingData } from "../app/persistence/training-storage";
import { parseFitlog } from "../app/interchange/fitlog";
import { neutralizeCsvCell } from "../app/interchange/csv-export";

Object.assign(globalThis, { indexedDB, IDBKeyRange });
test("CSV formula guard recognizes leading whitespace and ASCII control characters", () => {
  for (const prefix of ["\t", "\r", "\u0000", "\u001b", "\u007f", " \u0000 \t"]) {
    for (const formula of ["=1+1", "+1", "-2", "@SUM(A1)"]) assert.equal(neutralizeCsvCell(prefix + formula), "'" + prefix + formula);
  }
  assert.equal(neutralizeCsvCell("Regular notes"), "Regular notes");
});

test("aborted drain rejects queued Finish and never resurrects it; new editable retry/reset commits", async () => {
  const initial = validatedState(defaultState());
  await saveValidatedState(initial);
  const put = IDBObjectStore.prototype.put;
  let queued: Promise<void> | undefined;
  const rejectedFinish = validatedState({ ...initial, goals: ["Rejected final candidate"] });
  IDBObjectStore.prototype.put = function(value, key) {
    if (key === "training-state") {
      queued = saveValidatedState(rejectedFinish);
      void queued.catch(() => undefined);
      this.transaction.abort();
      throw new Error("QC abort");
    }
    return put.call(this, value, key);
  };
  try {
    await assert.rejects(saveValidatedState(validatedState({ ...initial, goals: ["Routine edit"] })), /QC abort/);
    await assert.rejects(queued!, /QC abort/);
  } finally { IDBObjectStore.prototype.put = put; }
  assert.deepEqual((await loadTrainingState())?.goals, []);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual((await loadTrainingState())?.goals, []);
  await resetTrainingData(initial);
  assert.deepEqual((await loadTrainingState())?.goals, []);
  const retry = validatedState({ ...initial, goals: ["Current editable state"] });
  await saveValidatedState(retry);
  assert.deepEqual((await loadTrainingState())?.goals, retry.goals);
});

test("enqueue during transaction completion microtasks has its own durable acknowledgement", async () => {
  const initial = validatedState(defaultState());
  await saveValidatedState(initial);
  const put = IDBObjectStore.prototype.put;
  let second: Promise<void> | undefined;
  let injected = false;
  IDBObjectStore.prototype.put = function(value, key) {
    const result = put.call(this, value, key);
    if (key === "training-state" && !injected) {
      injected = true;
      this.transaction.addEventListener("complete", () => {
        queueMicrotask(() => queueMicrotask(() => {
          second = saveValidatedState(validatedState({ ...initial, goals: ["Handoff edit"] }));
        }));
      });
    }
    return result;
  };
  try {
    await saveValidatedState(validatedState({ ...initial, goals: ["First"] }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(second); await second;
    assert.deepEqual((await loadTrainingState())?.goals, ["Handoff edit"]);
  } finally { IDBObjectStore.prototype.put = put; }
});

test("omitted activity TYPE warns; explicit TYPE remains authoritative without inferred warning", () => {
  const base = '[FITLOG:1]\nWORKOUT|QC|2026-10-04\nCARDIO|Run/walk intervals\n';
  const inferred = parseFitlog(base + 'DURATION|10\n[/FITLOG]', "lb", {});
  assert.match(inferred.importWarnings!.join(" "), /TYPE was omitted.*walk/);
  const explicit = parseFitlog(base + 'TYPE|run\nDURATION|10\n[/FITLOG]', "lb", {});
  assert.equal(explicit.cardio[0].activityType, "run");
  assert.ok(!explicit.importWarnings?.some(w => w.includes("TYPE was omitted")));
  assert.equal(explicit.cardio[0].completed, false);
});
