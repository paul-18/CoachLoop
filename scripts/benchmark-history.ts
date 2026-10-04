/** Node timings, NOT iPhone/browser paint timings. Writes only synthetic fake IndexedDB. */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { syntheticHistory } from "./qc-history-data";
import { validateSyncedState, validatedState, validateStateEdit } from "../app/persistence/training-validation";
import { prepareLoadedState } from "../app/persistence/migrations";
import { saveTrainingState, saveValidatedState, loadTrainingState, saveSnapshot, listSnapshots } from "../app/persistence/training-storage";
import { exportCompletedHistory } from "../app/interchange/history-export";
import { buildExerciseTrends } from "../app/domain/training-insights";
import type { TrainingState } from "../app/domain/training-types";

Object.assign(globalThis, { indexedDB, IDBKeyRange });
const measure = async (action: () => unknown, runs = 5) => {
  const times = [];
  for (let i = 0; i < runs; i++) { const start = performance.now(); await action(); times.push(performance.now() - start); }
  times.sort((a, b) => a - b);
  return { medianMs: +times[Math.floor(times.length / 2)].toFixed(2), maxMs: +times.at(-1)!.toFixed(2) };
};
function edited(state: TrainingState) {
  return { ...state, workouts: state.workouts.map((w, i) => i === state.workouts.length - 1 ? { ...w, exercises: w.exercises.map((e, j) => j ? e : { ...e, sets: e.sets.map((s, k) => k ? s : { ...s, actualReps: "9" }) }) } : w) };
}
const rows = [];
for (const count of [100, 1000, 5000]) {
  const state = validateSyncedState(syntheticHistory(count));
  const immutable = validatedState(state);
  await saveTrainingState(state);
  const validation = await measure(() => validateSyncedState(state));
  const clone = await measure(() => structuredClone(state));
  const editAndSave = await measure(async () => { const candidate = validateSyncedState(edited(state)); await saveTrainingState(candidate); });
  const editValidation = await measure(() => validateStateEdit(immutable, edited(immutable)));
  const optimizedEditAndSave = await measure(async () => { const candidate = validateStateEdit(immutable, edited(immutable)); await saveValidatedState(candidate); });
  const finalConfirmAndSave = await measure(async () => { const candidate = validatedState(edited(immutable)); await saveValidatedState(candidate); }, 3);
  const coldReadAndLoad = await measure(async () => prepareLoadedState(await loadTrainingState()), 3);
  const exportHistory = await measure(() => exportCompletedHistory(state, {}), 3);
  const historySearch = await measure(() => state.workouts.filter(w => `${w.name} ${w.exercises.map(e => e.name).join(" ")}`.toLowerCase().includes("bench")), 3);
  const progress = await measure(() => buildExerciseTrends(state), 3);
  const snapshotWrite = await measure(() => saveSnapshot(state, "benchmark"), 3);
  const snapshotList = await measure(() => listSnapshots(), 3);
  rows.push({ workouts: count, sets: count * 12, jsonBytes: Buffer.byteLength(JSON.stringify(state)), validation, clone, editAndSave, editValidation, optimizedEditAndSave, finalConfirmAndSave, coldReadAndLoad, exportHistory, historySearch, progress, snapshotWrite, snapshotList });
  console.log(JSON.stringify(rows.at(-1)));
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ environment: "Node + fake-indexeddb; no browser paint or physical iPhone", node: process.version, rows }, null, 2) + "\n");
