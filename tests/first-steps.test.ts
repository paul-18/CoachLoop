import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstSteps, sampleWorkout } from "../app/views/first-steps";
import { defaultState } from "../app/domain/training-types";
import { parseFitlog } from "../app/interchange/fitlog";

test("first-use guide starts with goals and profile, and the example is a short mixed session", () => {
  const state = defaultState();
  const today = renderToStaticMarkup(createElement(FirstSteps, { state, view: "today", onSetup: () => {}, onCoach: () => {}, onSample: () => {}, onImport: () => {} }));
  assert.match(today, /Add goals/);
  assert.match(today, /Add coach profile/);
  assert.match(today, /See an example workout/);
  assert.match(today, /Ask your AI stays off/);
  assert.doesNotMatch(today, /Paste a workout/);
  assert.doesNotMatch(today, />Ask your AI</);
  assert.doesNotMatch(today, /open=/);
  const ready = { ...state, goals: ["Bench press 185 lb"], coachProfile: "Train at a commercial gym." };
  const readyCard = renderToStaticMarkup(createElement(FirstSteps, { state: ready, view: "today", onSetup: () => {}, onCoach: () => {}, onSample: () => {} }));
  assert.match(readyCard, /Ask your AI/);
  const history = renderToStaticMarkup(createElement(FirstSteps, { state, view: "history", onSetup: () => {}, onCoach: () => {}, onSample: () => {} }));
  assert.match(history, /Start on Today/);
  assert.doesNotMatch(history, /Add goals/);
  const sample = parseFitlog(sampleWorkout(), "lb", {});
  assert.equal(sample.cardio[0]?.name, "Easy bike");
  assert.equal(sample.cardio[0]?.activityType, "bike");
  assert.equal(sample.cardio[0]?.plannedDurationMin, 5);
  assert.deepEqual(sample.exercises.map(exercise => exercise.name), ["Barbell Bench Press", "Pull-up", "Dip", "Dumbbell Lateral Raise"]);
  assert.equal(sample.exercises[0]?.sets[0]?.warmup, true);
  assert.equal(sample.exercises[0]?.sets[1]?.plannedWeight, 95);
  assert.equal(sample.exercises[1]?.sets[0]?.loadType, "bodyweight");
  assert.equal(sample.exercises[3]?.sets[0]?.weightMode, "per_hand");
  assert.equal(sample.cardio[1]?.activityType, "mobility");
  assert.equal(sample.cardio[1]?.mobilityMoves.length, 2);
  assert.ok(sample.exercises.every(exercise => exercise.sets.every(set => !set.completed)));
  assert.equal(sample.importWarnings?.length ?? 0, 0);
  assert.equal(state.workouts.length, 0);
  state.workouts.push({ ...sample, status: "completed" });
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state, view: "today", onSetup: () => {}, onCoach: () => {}, onSample: () => {} })), "");
  for (const view of ["history", "coach", "progress", "settings"] as const) {
    assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state, view, onSetup: () => {}, onCoach: () => {}, onSample: () => {} })), "", `${view} hides the starter guide after a completed workout`);
  }
});
