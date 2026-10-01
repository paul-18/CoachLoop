import test from "node:test";
import assert from "node:assert/strict";
import { makeCardio } from "../app/domain/training-types";
import { activityLoggingStyle, completeActivityEffort } from "../app/domain/activity-logging";
import { parseFitlog } from "../app/interchange/fitlog";
import { workoutToText } from "../app/interchange/coach-export";
import { storedStateBoundary } from "../app/persistence/training-validation";
import { defaultState } from "../app/domain/training-types";
import { runPlanStages } from "../app/views/run-plan";

test("drag effort prescriptions import in order, become actuals only when checked, and survive stored validation", () => {
  const workout = parseFitlog(`[FITLOG:1]
WORKOUT|Drag practice|2026-09-28
CARDIO|Sandbag drag
TYPE|other
EFFORT|20 m|90 lb|12 sec
EFFORT|20 m|90 lb|
REST|90
NOTES|Keep the feet moving.
[/FITLOG]`, "lb", {});
  const drag = workout.cardio[0];
  assert.equal(activityLoggingStyle(drag), "efforts");
  assert.equal(drag.effortRestSec, 90);
  assert.equal(drag.efforts?.[0].actualDistanceM, null);
  assert.equal(drag.efforts?.[1].plannedDurationSec, null);
  const first = completeActivityEffort(drag.efforts![0]);
  assert.deepEqual([first.actualDistanceM, first.actualLoad, first.actualDurationSec], [20, 90, 12]);
  const actual = { ...drag, completed: true, efforts: [first, drag.efforts![1]] };
  const state = defaultState();
  state.workouts = [{ ...workout, status: "completed", cardio: [actual] }];
  assert.equal(storedStateBoundary.safeParse(state).success, true);
  assert.match(workoutToText(state.workouts[0]), /20 m · 90 lb · 12 sec; not completed/);
});

test("old drag entries get effort logging without changing their saved fields", () => {
  const old = makeCardio("other", "Sled drag");
  delete old.loggingStyle;
  assert.equal(activityLoggingStyle(old), "efforts");
  assert.equal(activityLoggingStyle({ ...old, loggingStyle: "single" }), "single");
  assert.equal(activityLoggingStyle(makeCardio("mobility")), "routine");
  assert.equal(activityLoggingStyle(makeCardio("run")), "single");
});

test("soccer, grappling and yoga import as duration-based routines, and interval runs keep stage text", () => {
  const workout = parseFitlog(`[FITLOG:1]
WORKOUT|Field day|2026-09-30
CARDIO|Evening pickup
TYPE|soccer
DURATION|60
CARDIO|Mat practice
TYPE|grappling
DURATION|45
CARDIO|Evening flow
TYPE|yoga
DURATION|20
CARDIO|Track repeats
TYPE|run
DURATION|42
INTERVALS|10 min easy; 6 × 400 m @ 1:45 with 90 sec jog; 10 min easy
[/FITLOG]`, "lb", {});
  assert.deepEqual(workout.cardio.map((item) => item.activityType), ["soccer", "grappling", "yoga", "run"]);
  assert.deepEqual(workout.cardio.map(activityLoggingStyle), ["routine", "routine", "routine", "single"]);
  assert.deepEqual(runPlanStages(workout.cardio[3].intervals), ["10 min easy", "6 × 400 m @ 1:45 with 90 sec jog", "10 min easy"]);
  const state = defaultState(); state.workouts = [workout];
  assert.equal(storedStateBoundary.safeParse(state).success, true);
});
