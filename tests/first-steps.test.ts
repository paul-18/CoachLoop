import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstSteps, sampleWorkout } from "../app/views/first-steps";
import { defaultState } from "../app/domain/training-types";
import { parseFitlog } from "../app/interchange/fitlog";

test("first-use guide is available in empty tabs and an example does not invent results", () => {
  const state = defaultState();
  for (const view of ["today", "history", "coach", "progress"] as const) {
    const html = renderToStaticMarkup(createElement(FirstSteps, { state, view, onSetup: () => {}, onCoach: () => {}, onSample: () => {} }));
    assert.match(html, /Rank your training goals/);
    assert.match(html, /Try example import/);
  }
  const sample = parseFitlog(sampleWorkout(), "lb", {});
  assert.ok(sample.exercises.length);
  assert.ok(sample.exercises.every(exercise => exercise.sets.every(set => !set.completed)));
  assert.equal(state.workouts.length, 0);
  state.workouts.push({ ...sample, status: "completed" });
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state, view: "today", onSetup: () => {}, onCoach: () => {}, onSample: () => {} })), "");
  const help = renderToStaticMarkup(createElement(FirstSteps, { state, view: "settings", alwaysAvailable: true, onSetup: () => {}, onCoach: () => {}, onSample: () => {} }));
  assert.match(help, /Log results, then finish/);
  assert.doesNotMatch(help, /<details[^>]* open=/, 'returning users can reopen the collapsed guide without a forced onboarding flow');
});
