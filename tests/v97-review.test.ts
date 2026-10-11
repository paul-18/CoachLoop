import test from "node:test";
import assert from "node:assert/strict";
import { displayedDistance } from "../app/domain/completion";
import { strengthRecords } from "../app/domain/training-metrics";
import { defaultState, makeSet, makeWorkout } from "../app/domain/training-types";
import { storedStateBoundary } from "../app/persistence/training-validation";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickLogButtons } from "../app/views/quick-log-buttons";

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
  const markup = renderToStaticMarkup(createElement(QuickLogButtons, { settings: defaultState().settings, disabled: false, limited: true, onChoose: () => {} }));
  assert.match(markup, />Run</);
  assert.match(markup, />Bike</);
  assert.match(markup, />Circuit</);
  assert.match(markup, />Yoga</);
  assert.doesNotMatch(markup, />Swim</);
  assert.doesNotMatch(markup, />Ruck</);
});
