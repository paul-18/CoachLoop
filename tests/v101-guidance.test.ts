import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultState, makeWorkout } from "../app/domain/training-types";
import { FirstSteps } from "../app/views/first-steps";
import { addSamplePlan, blankStartReversible, blankStartState, exampleSetupState, undoBlankStart } from "../app/views/starter-plan";
import { DEFAULT_QUICK_LOG_ACTIVITIES, STARTER_QUICK_LOG_ACTIVITIES } from "../app/domain/training-types";

test("a blank start can be undone before anything is added", () => {
  const blank = blankStartState(defaultState());
  assert.equal(blankStartReversible(blank), true);
  const back = undoBlankStart(blank);
  assert.equal(back.settings.welcomeChoice, undefined);
  assert.deepEqual(back.settings.quickLogActivities, [...DEFAULT_QUICK_LOG_ACTIVITIES]);
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { state: back, view: "today", onStarter: () => {}, onBlank: () => {} })), renderToStaticMarkup(createElement(FirstSteps, { state: defaultState(), view: "today", onStarter: () => {}, onBlank: () => {} })));
  const used = blankStartState(defaultState());
  used.workouts = [makeWorkout("lb", 20)];
  assert.equal(blankStartReversible(used), false);
  assert.equal(undoBlankStart(used), used);
});

test("changing the quick-log list survives going back from a blank start", () => {
  const blank = blankStartState(defaultState());
  blank.settings.quickLogActivities = ["run"];
  assert.deepEqual(undoBlankStart(blank).settings.quickLogActivities, ["run"]);
  assert.deepEqual(STARTER_QUICK_LOG_ACTIVITIES, ["run", "bike", "circuit", "yoga"]);
});

test("the welcome screen explains the log before the choices", () => {
  const markup = renderToStaticMarkup(createElement(FirstSteps, { state: defaultState(), view: "today", onStarter: () => {}, onBlank: () => {} }));
  const choice = markup.indexOf("Explore a sample log");
  const explanation = markup.indexOf("private workout log");
  assert.ok(explanation >= 0 && explanation < choice);
  assert.match(markup, /no AI inside the app/);
  assert.match(markup, /FITLOG/);
});

test("the starter plan is still a planned example", () => {
  const started = addSamplePlan(exampleSetupState(defaultState()));
  assert.equal(started.workouts[0]?.status, "planned");
  assert.equal(started.workouts[0]?.starterSeed, true);
});
