import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { makeActivityEffort } from "../app/domain/activity-logging";
import { unusualActivityWarning, unusualWorkoutWarning } from "../app/domain/activity-plausibility";
import { defaultState, makeCardio, makeWorkout } from "../app/domain/training-types";
import { WorkoutEditor } from "../app/views/workout-editor";

const editor = (activity: ReturnType<typeof makeCardio>) => {
  const workout = makeWorkout("lb", 60, "Run session");
  workout.exercises = [];
  workout.cardio = [activity];
  workout.blockOrder = [{ type: "activity", id: activity.id }];
  return { workout, markup: renderToStaticMarkup(createElement(WorkoutEditor, {
    workout, state: defaultState(), saveStatus: "saved", onUpdate: () => {}, onFinish: async () => {}, onBack: () => {}, onIncrement: () => {},
  })) };
};

test("planned_distance_without_actual_duration_does_not_warn", () => {
  const activity = { ...makeCardio("run"), completed: true, plannedDistanceKm: 203, plannedDurationMin: 40, actualDistanceKm: null, actualDurationMin: null };
  assert.equal(unusualActivityWarning(activity), null);
  const { markup } = editor(activity);
  assert.doesNotMatch(markup, /0 min/);
  assert.doesNotMatch(markup, /look unusual/);
});

test("actual_distance_without_duration_does_not_trigger_pace_check", () => {
  const activity = { ...makeCardio("run"), actualDistanceKm: 10, actualDurationMin: null, plannedDurationMin: 1 };
  const warning = unusualActivityWarning(activity);
  assert.equal(warning, null);
  assert.equal(unusualWorkoutWarning({ ...makeWorkout("lb", 60), cardio: [activity] }), null);
});

test("implausible_actual_pace_still_warns", () => {
  const activity = { ...makeCardio("run"), actualDistanceKm: 10, actualDurationMin: 1 };
  assert.match(unusualActivityWarning(activity) ?? "", /10 km in 1 min/);
  const { markup, workout } = editor(activity);
  assert.match(markup, /10 km in 1 min/);
  assert.equal(workout.cardio[0].actualDistanceKm, 10);
  assert.equal(workout.cardio[0].actualDurationMin, 1);
});

test("normal_actual_pace_does_not_warn", () => {
  assert.equal(unusualActivityWarning({ ...makeCardio("run"), actualDistanceKm: 5, actualDurationMin: 25 }), null);
  assert.equal(unusualActivityWarning({ ...makeCardio("bike"), actualDistanceKm: 30, actualDurationMin: 60 }), null);
});

test("missing_zero_invalid_and_partial_actual_values_are_handled", () => {
  assert.equal(unusualActivityWarning({ ...makeCardio("run"), actualDistanceKm: null, actualDurationMin: null, plannedDistanceKm: 12 }), null);
  assert.match(unusualActivityWarning({ ...makeCardio("run"), actualDistanceKm: 5, actualDurationMin: 0 }) ?? "", /5 km in 0 min/);
  assert.equal(unusualActivityWarning({ ...makeCardio("run"), actualDistanceKm: 0, actualDurationMin: 0 }), null);
  assert.equal(unusualActivityWarning({ ...makeCardio("run"), actualDistanceKm: Number.NaN, actualDurationMin: 10 }), null);
  assert.equal(unusualActivityWarning({ ...makeCardio("run"), actualDistanceKm: 8, actualDurationMin: Number.POSITIVE_INFINITY }), null);
  assert.equal(unusualActivityWarning({ ...makeCardio("run"), actualDistanceKm: 8, actualDurationMin: -1 }), null);
  const partial = makeCardio("run");
  partial.loggingStyle = "efforts";
  partial.efforts = [{ ...makeActivityEffort(), completed: true, actualDistanceM: 400, actualDurationSec: null }];
  assert.equal(unusualActivityWarning(partial), null);
  const skipped = { ...makeCardio("run"), skipped: true, actualDistanceKm: 50, actualDurationMin: 1 };
  assert.equal(unusualActivityWarning(skipped), null);
});

test("warning_does_not_modify_workout_values", () => {
  const activity = { ...makeCardio("bike"), plannedDistanceKm: 40, actualDistanceKm: 40, actualDurationMin: 1, plannedDurationMin: 90 };
  const workout = makeWorkout("lb", 60);
  workout.cardio = [activity];
  const before = structuredClone(workout);
  assert.match(unusualWorkoutWarning(workout) ?? "", /40 km in 1 min/);
  assert.deepEqual(workout, before);
});
