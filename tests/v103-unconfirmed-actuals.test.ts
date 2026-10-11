import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { makeActivityEffort } from "../app/domain/activity-logging";
import { hasGenuineTraining, markTypedActivitiesComplete, shouldPromptForUnconfirmedActuals, unconfirmedActualActivities, unconfirmedActualKey } from "../app/domain/completion";
import { defaultState, makeCardio, makeWorkout } from "../app/domain/training-types";
import { finishWorkoutState } from "../app/domain/workout-transitions";
import { prepareLoadedState } from "../app/persistence/migrations";
import { HistoryView } from "../app/views/history-view";
import { summarizeWorkout } from "../app/views/shared";
import { UnconfirmedActualsPrompt } from "../app/views/workout-editor";

const loggedRun = (distance: number | null, minutes: number | null, name = "Evening run") => {
  const activity = { ...makeCardio("run"), name, completed: false, actualDistanceKm: distance, actualDurationMin: minutes };
  const workout = makeWorkout("lb", 60, "Run session");
  workout.exercises = [];
  workout.cardio = [activity];
  workout.blockOrder = [{ type: "activity", id: activity.id }];
  return workout;
};

test("finish_prompts_for_actual_results_on_incomplete_activity", () => {
  const workout = loggedRun(8, 42);
  assert.equal(shouldPromptForUnconfirmedActuals(workout, null), true);
  assert.deepEqual(unconfirmedActualActivities(workout).map((activity) => activity.name), ["Evening run"]);
  const markup = renderToStaticMarkup(createElement(UnconfirmedActualsPrompt, {
    activities: [{ id: "run", name: "Evening run" }, { id: "bike", name: "Ride" }],
    onMarkAndFinish: () => {},
    onFinishIncomplete: () => {},
    onReturn: () => {},
  }));
  assert.match(markup, /Evening run/);
  assert.match(markup, /Ride/);
  assert.match(markup, /Mark complete and finish/);
  assert.match(markup, /Finish and leave them incomplete/);
  assert.match(markup, /Back to the workout/);
  assert.equal(shouldPromptForUnconfirmedActuals(workout, unconfirmedActualKey(workout)), false);
});

test("marking_activity_complete_preserves_actual_results_in_history", () => {
  const workout = loggedRun(8.5, 41);
  const marked = markTypedActivitiesComplete(workout, [workout.cardio[0].id]);
  assert.equal(marked.cardio[0].completed, true);
  assert.equal(marked.cardio[0].actualDistanceKm, 8.5);
  assert.equal(marked.cardio[0].actualDurationMin, 41);
  assert.equal(marked.cardio[0].plannedDistanceKm, null);
  const state = finishWorkoutState({ ...defaultState(), workouts: [marked] }, marked);
  assert.equal(hasGenuineTraining(state.workouts[0]), true);
  assert.equal(state.settings.firstWorkoutNote, "show");
  const markup = renderToStaticMarkup(createElement(HistoryView, {
    state, onEdit: () => {}, onRepeat: () => {}, onReplan: () => {}, onDelete: () => {},
  }));
  assert.match(markup, /8\.50 km/);
  assert.match(markup, /41 cardio min/);
  assert.doesNotMatch(summarizeWorkout(state.workouts[0]), /No work recorded/);
});

test("finishing_without_marking_complete_preserves_actual_values", () => {
  const workout = loggedRun(6, 33);
  const before = structuredClone(workout.cardio[0]);
  const state = finishWorkoutState({ ...defaultState(), workouts: [workout] }, workout);
  const saved = state.workouts[0].cardio[0];
  assert.equal(saved.completed, false);
  assert.equal(saved.actualDistanceKm, before.actualDistanceKm);
  assert.equal(saved.actualDurationMin, before.actualDurationMin);
  assert.equal(hasGenuineTraining(state.workouts[0]), false);
  assert.equal(state.settings.firstWorkoutNote, undefined);
  const markup = renderToStaticMarkup(createElement(HistoryView, {
    state, onEdit: () => {}, onRepeat: () => {}, onReplan: () => {}, onDelete: () => {},
  }));
  assert.match(markup, /6 km/);
  assert.match(markup, /33 min/);
  assert.match(markup, /Not completed/);
  assert.match(summarizeWorkout(state.workouts[0]), /entered results that are not marked complete/);
  assert.doesNotMatch(summarizeWorkout(state.workouts[0]), /No work recorded/);
});

test("returning_to_edit_preserves_entered_actual_values", () => {
  const workout = loggedRun(4, 20);
  const snapshot = structuredClone(workout);
  let returned = false;
  renderToStaticMarkup(createElement(UnconfirmedActualsPrompt, {
    activities: [{ id: workout.cardio[0].id, name: workout.cardio[0].name }],
    onMarkAndFinish: () => {},
    onFinishIncomplete: () => {},
    onReturn: () => { returned = true; },
  }));
  assert.equal(returned, false);
  assert.deepEqual(workout, snapshot);
  assert.equal(shouldPromptForUnconfirmedActuals(workout, null), true);
});

test("untouched_fields_do_not_trigger_finish_confirmation", () => {
  const workout = loggedRun(null, null);
  assert.deepEqual(unconfirmedActualActivities(workout), []);
  assert.equal(shouldPromptForUnconfirmedActuals(workout, null), false);
  const plannedOnly = loggedRun(null, null);
  plannedOnly.cardio[0].plannedDistanceKm = 10;
  plannedOnly.cardio[0].plannedDurationMin = 50;
  plannedOnly.cardio[0].notes = "";
  assert.deepEqual(unconfirmedActualActivities(plannedOnly), []);
});

test("skipped_and_completed_activities_are_handled_correctly", () => {
  const skipped = loggedRun(12, 70, "Skipped ride");
  skipped.cardio[0].skipped = true;
  skipped.cardio[0].activityType = "bike";
  const completed = { ...makeCardio("yoga"), name: "Yoga", completed: true, actualDurationMin: 20 };
  const partial = makeCardio("run");
  partial.name = "Intervals";
  partial.loggingStyle = "efforts";
  const done = { ...makeActivityEffort(), completed: true, actualDistanceM: 200, actualDurationSec: 40 };
  const typed = { ...makeActivityEffort(), completed: false, actualDistanceM: 400, actualDurationSec: 90 };
  const blank = { ...makeActivityEffort(), completed: false };
  partial.efforts = [done, typed, blank];
  const workout = makeWorkout("lb", 60);
  workout.exercises = [];
  workout.cardio = [skipped.cardio[0], completed, partial];
  const pending = unconfirmedActualActivities(workout);
  assert.deepEqual(pending.map((activity) => activity.name), ["Intervals"]);
  const marked = markTypedActivitiesComplete(workout, pending.map((activity) => activity.id));
  const efforts = marked.cardio[2].efforts ?? [];
  assert.equal(efforts[0].completed, true);
  assert.equal(efforts[1].completed, true);
  assert.equal(efforts[1].actualDistanceM, 400);
  assert.equal(efforts[2].completed, false);
  assert.equal(marked.cardio[0].completed, false);
  assert.equal(marked.cardio[0].actualDistanceKm, 12);
});

test("multiple_incomplete_activities_are_confirmed_together", () => {
  const run = loggedRun(5, 28, "Run");
  const ride = { ...makeCardio("bike"), name: "Ride", completed: false, actualDistanceKm: 16, actualDurationMin: null };
  run.cardio.push(ride);
  run.blockOrder.push({ type: "activity", id: ride.id });
  const pending = unconfirmedActualActivities(run);
  assert.deepEqual(pending.map((activity) => activity.name), ["Run", "Ride"]);
  const marked = markTypedActivitiesComplete(run, pending.map((activity) => activity.id));
  assert.equal(marked.cardio.every((activity) => activity.completed), true);
  assert.equal(marked.cardio[1].actualDistanceKm, 16);
  assert.equal(marked.cardio[1].actualDurationMin, null);
  assert.equal(marked.cardio[1].plannedDurationMin, null);
});

test("existing_logs_and_backup_compatibility_are_preserved", () => {
  const workout = loggedRun(9, 48);
  workout.status = "completed";
  workout.completedAt = "2026-01-02T12:00:00.000Z";
  const state = defaultState();
  state.workouts = [workout];
  const loaded = prepareLoadedState(JSON.parse(JSON.stringify(state)));
  const activity = loaded.workouts[0].cardio[0];
  assert.equal(activity.completed, false);
  assert.equal(activity.actualDistanceKm, 9);
  assert.equal(activity.actualDurationMin, 48);
  assert.equal(JSON.stringify(loaded.workouts[0].cardio[0]), JSON.stringify(workout.cardio[0]));
});
