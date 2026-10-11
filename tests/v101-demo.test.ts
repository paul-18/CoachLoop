import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexedDB } from "fake-indexeddb";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildDemoState, projectDemoUpdate } from "../app/domain/demo-session";
import { defaultState, makeSet, makeWorkout } from "../app/domain/training-types";
import { validatedState } from "../app/persistence/training-validation";
import { listSnapshots, loadTrainingState, saveValidatedState } from "../app/persistence/training-storage";
import { SettingsView } from "../app/views/settings-view";
import { DemoBar } from "../app/views/demo-bar";

Object.defineProperty(globalThis, "indexedDB", { value: indexedDB, configurable: true });

async function storedSnapshot() {
  return JSON.stringify(await loadTrainingState());
}

test("demo edits do not change an empty or a populated saved log", async () => {
  const empty = validatedState(defaultState());
  await saveValidatedState(empty);
  const emptyBefore = await storedSnapshot();
  const emptySnaps = await listSnapshots();
  const demo = validatedState(buildDemoState("2026-10-11"));
  const edited = projectDemoUpdate(empty, demo, current => ({ ...current, goals: ["Changed only in demo"] }));
  assert.equal(edited.real, empty);
  assert.equal(edited.demo?.goals[0], "Changed only in demo");
  assert.equal(await storedSnapshot(), emptyBefore);
  assert.deepEqual(await listSnapshots(), emptySnaps);

  const populated = defaultState();
  const workout = makeWorkout("lb", 90, "Real bench");
  workout.status = "completed";
  workout.completedAt = "2026-10-01T12:00:00.000Z";
  workout.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5", actualWeight: 185, loadType: "weighted" })];
  populated.workouts = [workout];
  populated.goals = ["Keep this goal"];
  const real = validatedState(populated);
  await saveValidatedState(real);
  const filledBefore = await storedSnapshot();
  const again = projectDemoUpdate(real, validatedState(buildDemoState("2026-10-11")), current => ({ ...current, coachProfile: "Demo only" }));
  assert.equal(again.real.goals[0], "Keep this goal");
  assert.equal(again.real.workouts[0]?.name, "Real bench");
  assert.equal(await storedSnapshot(), filledBefore);
});

test("demo code does not touch the service worker, the editor lease, or IndexedDB", () => {
  const session = readFileSync(new URL("../app/domain/demo-session.ts", import.meta.url), "utf8");
  assert.doesNotMatch(session, /serviceWorker|indexedDB|navigator\.locks|caches/);
  const persistence = readFileSync(new URL("../app/persistence/use-training-persistence.ts", import.meta.url), "utf8");
  assert.match(persistence, /if \(demoRef\.current\) return/);
  assert.match(persistence, /demoRef\.current \|\| operation\.current/);
  assert.doesNotMatch(persistence, /acquireEditorLease|serviceWorker\.register/);
  const markup = renderToStaticMarkup(createElement(DemoBar, { onExit: () => {} }));
  assert.match(markup, /Demo mode/);
  assert.match(markup, /Exit demo/);
  const settings = renderToStaticMarkup(createElement(SettingsView, {
    state: defaultState(),
    canonicalState: defaultState(),
    setState: () => {},
    onResolveConflict: async () => {},
    onRestoreBackup: async () => {},
    onReset: async () => {},
    syncStatus: "synced",
    syncFailure: null,
    onRetrySync: () => {},
    lastSyncedAt: null,
    offlineReady: "ready",
    updateReady: false,
    demoActive: true,
  }));
  assert.match(settings, /off in demo mode/);
  assert.match(settings, /disabled/);
});
