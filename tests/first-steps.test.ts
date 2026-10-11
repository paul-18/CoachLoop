import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstSteps, sampleWorkout } from "../app/views/first-steps";
import { defaultState } from "../app/domain/training-types";
import { parseFitlog } from "../app/interchange/fitlog";

test("first-use guide is a short today card and an example does not invent results", () => {
  const state = defaultState();
  const today = renderToStaticMarkup(createElement(FirstSteps, { state, view: "today", onSetup: () => {}, onCoach: () => {}, onSample: () => {}, onImport: () => {} }));
  assert.match(today, /Try a safe example/);
  assert.match(today, /How this works/);
  assert.match(today, /Rank your training goals/);
  assert.doesNotMatch(today, /open=/);
  const history = renderToStaticMarkup(createElement(FirstSteps, { state, view: "history", onSetup: () => {}, onCoach: () => {}, onSample: () => {} }));
  assert.match(history, /Start on Today/);
  assert.doesNotMatch(history, /Rank your training goals/);
  const sample = parseFitlog(sampleWorkout(), "lb", {});
  assert.equal(sample.exercises[0]?.name, "Bodyweight squat");
  assert.equal(sample.exercises[0]?.sets[0]?.warmup, true);
  assert.ok(sample.exercises.every(exercise => exercise.sets.every(set => !set.completed)));
  assert.equal(sample.cardio[0]?.activityType, "walk");
  assert.equal(sample.importWarnings?.length ?? 0, 0);
  assert.equal(state.workouts.length, 0);
  state.workouts.push({ ...sample, status: "completed" });
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state, view: "today", onSetup: () => {}, onCoach: () => {}, onSample: () => {} })), "");
  for (const view of ["history", "coach", "progress", "settings"] as const) {
    assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state, view, onSetup: () => {}, onCoach: () => {}, onSample: () => {} })), "", `${view} hides the starter guide after a completed workout`);
  }
});
