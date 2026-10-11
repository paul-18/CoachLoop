import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstSteps, sampleWorkout } from "../app/views/first-steps";
import { defaultState } from "../app/domain/training-types";
import { parseFitlog } from "../app/interchange/fitlog";
import { WORKOUT_TEMPLATES } from "../app/domain/setup-content";

test("quick setup is skippable, templates stay uncompleted, and it disappears after a finished workout", () => {
  const state = defaultState();
  const html = renderToStaticMarkup(createElement(FirstSteps, { state, view: "today", onFinish: () => {}, onTemplate: () => {} }));
  assert.match(html, /Quick setup/);
  assert.match(html, /Skip/);
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state, view: "history", onFinish: () => {}, onTemplate: () => {} })), "");
  for (const template of WORKOUT_TEMPLATES) {
    const parsed = parseFitlog(template.fitlog(), "lb", {});
    assert.ok(parsed.exercises.length + parsed.cardio.length > 0, template.id);
    assert.ok(parsed.exercises.every(exercise => exercise.sets.every(set => !set.completed)));
    assert.ok(parsed.cardio.every(activity => !activity.completed));
  }
  const sample = parseFitlog(sampleWorkout(), "lb", {});
  assert.ok(sample.exercises.length);
  state.workouts.push({ ...sample, status: "completed" });
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state, view: "today", onFinish: () => {}, onTemplate: () => {} })), "");
  const finished = defaultState();
  finished.settings = { ...finished.settings, setupComplete: true };
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state: finished, view: "today", onFinish: () => {}, onTemplate: () => {} })), "");
});
