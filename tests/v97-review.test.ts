import test from "node:test";
import assert from "node:assert/strict";
import { displayedDistance } from "../app/domain/completion";
import { strengthRecords } from "../app/domain/training-metrics";
import { defaultState, makeSet, makeWorkout, QUICK_LOG_OPTIONS } from "../app/domain/training-types";
import { storedStateBoundary } from "../app/persistence/training-validation";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickLogButtons } from "../app/views/quick-log-buttons";
import { WorkoutEditor } from "../app/views/workout-editor";
import { exampleFitlog, parseFitlog } from "../app/interchange/fitlog";
import { blankStartState, exampleSetupState } from "../app/views/starter-plan";

test("1005 metres displays as 1005, not a binary tail", () => {
  assert.equal(displayedDistance(1005 / 1000, "m"), 1005);
  assert.equal(String(1005 / 1000 * 1000).includes("999999"), true);
});

test("a future settings field survives validation", () => {
  const raw = defaultState();
  const parsed = storedStateBoundary.parse({ ...raw, settings: { ...raw.settings, futureToggle: true } });
  assert.equal((parsed.settings as { futureToggle?: boolean }).futureToggle, true);
});

test("NaN weight is not treated as a positive load", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 90);
  workout.status = "completed";
  workout.date = "2026-10-01";
  workout.exercises[0].name = "Barbell Bench Press";
  workout.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5", actualWeight: Number.NaN, plannedWeight: 135, loadType: "weighted", weightMode: "total" })];
  state.workouts = [workout];
  assert.equal(strengthRecords(state, "lb").size, 0);
});

test("a new log only offers run, bike, circuit and yoga", () => {
  for (const next of [exampleSetupState(defaultState()), blankStartState(defaultState())]) {
    assert.deepEqual(next.settings.quickLogActivities, ["run", "bike", "circuit", "yoga"]);
    const markup = renderToStaticMarkup(createElement(QuickLogButtons, { settings: next.settings, disabled: false, onChoose: () => {} }));
    assert.match(markup, />Run</);
    assert.doesNotMatch(markup, />Swim</);
    assert.doesNotMatch(markup, />Ruck</);
  }
  assert.ok(QUICK_LOG_OPTIONS.some(option => option.type === "swim"));
  assert.ok(defaultState().settings.quickLogActivities?.includes("water_polo"));
});

test("the example bike stays closed until it is logged", () => {
  const workout = parseFitlog(exampleFitlog(), "lb", {});
  const markup = renderToStaticMarkup(createElement(WorkoutEditor, { workout, state: defaultState(), saveStatus: "saved", onUpdate: () => {}, onFinish: async () => {}, onBack: () => {}, onIncrement: () => {} }));
  assert.match(markup, /Log Easy bike/);
  assert.match(markup, /5 min/);
  assert.doesNotMatch(markup, /Activity name/);
});
