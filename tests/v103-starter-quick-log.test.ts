import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildDemoState, projectDemoUpdate } from "../app/domain/demo-session";
import { DEFAULT_QUICK_LOG_ACTIVITIES, STARTER_QUICK_LOG_ACTIVITIES, defaultState, makeWorkout, type TrainingState } from "../app/domain/training-types";
import { TodayView } from "../app/views/today-view";
import { addSamplePlan, blankStartState, exampleSetupState, removeStarterState, starterRemovable, starterRemovalDescription } from "../app/views/starter-plan";

const today = (state: TrainingState) => renderToStaticMarkup(createElement(TodayView, {
  state,
  syncStatus: "synced",
  onHyrox: () => {},
  onStartBlank: () => {},
  onQuickCardio: () => {},
  onImport: () => {},
  onCoach: () => {},
  onResume: () => {},
  onStartPlan: () => {},
  onReschedulePlan: () => {},
  onSkipPlan: () => {},
  onHistory: () => {},
  onBodyweightLog: () => {},
  onTrainingCalendar: () => {},
}));

test("remove_starter_visible_when_starter_is_removable", () => {
  const setup = exampleSetupState(defaultState());
  setup.goals = [];
  assert.equal(starterRemovable(setup), true);
  assert.match(today(setup), /Remove starter/);
  const withHistory = addSamplePlan(exampleSetupState(defaultState()));
  const done = makeWorkout("lb", 30);
  done.status = "completed";
  withHistory.workouts.push(done);
  assert.equal(starterRemovable(withHistory), true);
  assert.match(today(withHistory), /Remove starter/);
  assert.doesNotMatch(today(blankStartState(defaultState())), /Remove starter/);
});

test("remove_starter_confirmation_matches_actual_removable_state", () => {
  const setup = exampleSetupState(defaultState());
  const noSession = starterRemovalDescription(setup);
  assert.match(noSession, /no starter workout to remove/);
  assert.doesNotMatch(noSession, /sample starter workout/);
  assert.match(noSession, /Starter goals that are still the examples will be cleared/);
  const added = addSamplePlan(setup);
  const withSession = starterRemovalDescription(added);
  assert.match(withSession, /This removes the sample starter workout/);
  assert.doesNotMatch(withSession, /no starter workout to remove/);
  added.goals = ["My goal"];
  added.coachProfile = "My notes";
  const kept = starterRemovalDescription(added);
  assert.match(kept, /Your goals stay/);
  assert.match(kept, /Your coach profile stays/);
  assert.match(kept, /Other workouts stay/);
});

test("removing_starter_does_not_delete_real_workout_history", () => {
  const started = addSamplePlan(exampleSetupState(defaultState()));
  const real = makeWorkout("lb", 40);
  real.status = "completed";
  real.name = "Logged session";
  real.exercises[0].sets[0].completed = true;
  real.exercises[0].sets[0].actualReps = "5";
  started.workouts.push(real);
  const removed = removeStarterState(started);
  assert.deepEqual(removed.workouts.map(workout => workout.name), ["Logged session"]);
  assert.equal(removed.workouts[0].exercises[0].sets[0].completed, true);
  assert.equal(removed.workouts[0].exercises[0].sets[0].actualReps, "5");
  assert.ok(removed.deletedWorkoutIds.includes(started.workouts[0].id));
  assert.ok(!removed.deletedWorkoutIds.includes(real.id));
});

test("onboarding_quick_log_options_are_consistent", () => {
  assert.deepEqual(STARTER_QUICK_LOG_ACTIVITIES, ["run", "bike", "circuit", "yoga"]);
  assert.deepEqual(exampleSetupState(defaultState()).settings.quickLogActivities, [...STARTER_QUICK_LOG_ACTIVITIES]);
  assert.deepEqual(blankStartState(defaultState()).settings.quickLogActivities, [...STARTER_QUICK_LOG_ACTIVITIES]);
  assert.deepEqual(addSamplePlan(defaultState()).settings.quickLogActivities, [...STARTER_QUICK_LOG_ACTIVITIES]);
  assert.deepEqual(addSamplePlan(exampleSetupState(defaultState())).settings.quickLogActivities, [...STARTER_QUICK_LOG_ACTIVITIES]);
});

test("quick_log_customization_is_preserved", () => {
  const custom = defaultState();
  custom.settings.quickLogActivities = ["swim", "ruck"];
  custom.settings.defaultUnit = "kg";
  const added = addSamplePlan(custom);
  assert.deepEqual(added.settings.quickLogActivities, ["swim", "ruck"]);
  assert.equal(added.settings.defaultUnit, "kg");
  const removed = removeStarterState(added);
  assert.deepEqual(removed.settings.quickLogActivities, ["swim", "ruck"]);
  assert.equal(removed.settings.defaultUnit, "kg");
  const chosen = blankStartState(defaultState());
  chosen.settings.quickLogActivities = ["yoga"];
  assert.deepEqual(addSamplePlan(chosen).settings.quickLogActivities, ["yoga"]);
});

test("demo_data_remains_isolated_from_real_profile", () => {
  const real = defaultState();
  real.coachProfile = "Real profile";
  real.goals = ["Real goal"];
  real.settings.quickLogActivities = [...DEFAULT_QUICK_LOG_ACTIVITIES];
  const before = structuredClone(real);
  const demo = buildDemoState();
  assert.match(demo.coachProfile, /not your profile/);
  assert.notEqual(demo, real);
  const projected = projectDemoUpdate(real, demo, (current) => ({ ...current, coachProfile: "Edited demo", goals: ["Demo goal"] }));
  assert.equal(projected.real, real);
  assert.equal(projected.real.coachProfile, "Real profile");
  assert.equal(projected.demo?.coachProfile, "Edited demo");
  assert.deepEqual(real, before);
});
