import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APP_RELEASE } from "../app/app-release";
import { activityHistoryLabel, hasCompletedActivityWork, hasGenuineTraining, hasTrainingActivity, hasTrainingEvidence } from "../app/domain/completion";
import { makeActivityEffort } from "../app/domain/activity-logging";
import { trainingWeekStreak } from "../app/domain/training-streak";
import { workoutProgressCopy } from "../app/domain/completion";
import { finishWorkoutState } from "../app/domain/workout-transitions";
import { DEFAULT_COACH_PROFILE, workoutToText } from "../app/interchange/coach-export";
import { exportCompletedHistory } from "../app/interchange/history-export";
import { FITLOG_V3_INSTRUCTIONS, FITLOG_V3_REMINDER } from "../app/interchange/fitlog";
import { trainingCsvRows } from "../app/interchange/training-csv";
import { defaultState, makeCardio, makeWorkout, type ActivityEffort, type MobilityMove } from "../app/domain/training-types";
import { HistoryView } from "../app/views/history-view";
import { parseBackupReview, serializeBackup } from "../app/persistence/backup-tools";
import { prepareLoadedState } from "../app/persistence/migrations";
import { validateSyncedState } from "../app/persistence/training-validation";

test("release is v120; nested move and effort data survives current validation", () => {
  assert.equal(APP_RELEASE, "v120");
  const state = defaultState();
  const workout = makeWorkout("lb", 90);
  const run = makeCardio("run");
  const mobility = makeCardio("mobility");
  workout.cardio = [run, mobility];
  state.workouts = [workout];
  const futureState = structuredClone(state) as unknown as { workouts: Array<{ cardio: Array<Record<string, unknown>> }> };
  futureState.workouts[0].cardio[0].efforts = [{ ...makeActivityEffort(), futureSplit: { marker: "preserved" } }];
  futureState.workouts[0].cardio[1].mobilityMoves = [{ id: "move-1", name: "Hip opener", prescription: "2 x 8/side", futureCue: "preserved" }];

  const validated = validateSyncedState(futureState);
  assert.deepEqual((validated.workouts[0].cardio[0].efforts?.[0] as ActivityEffort & { futureSplit: { marker: string } }).futureSplit, { marker: "preserved" });
  assert.equal((validated.workouts[0].cardio[1].mobilityMoves[0] as MobilityMove & { futureCue: string }).futureCue, "preserved");
});

test("v105 stamp-free backup imports unchanged; v107 backup stamps and round-trips state", () => {
  const original = defaultState();
  const v105Text = JSON.stringify(original); // v105 exported the state without writtenByRelease.
  const v105Review = parseBackupReview(v105Text);
  assert.deepEqual(v105Review.state, prepareLoadedState(original), "legacy imports receive current defaults without losing saved data");
  assert.equal(v105Review.writtenByRelease, null);
  assert.equal(v105Review.newerReleaseWarning, null);
  assert.equal(v105Text, JSON.stringify(original), "review does not mutate source data");

  const currentState = prepareLoadedState(original);
  const exported = serializeBackup(currentState);
  assert.equal(JSON.parse(exported).writtenByRelease, "v120");
  assert.deepEqual(parseBackupReview(exported).state, currentState);
});

test("newer backup warning uses numeric release order and exact blocking copy", () => {
  const state = defaultState();
  const future = { ...state, writtenByRelease: "v121" };
  const review = parseBackupReview(JSON.stringify(future));
  assert.equal(review.newerReleaseWarning, "This backup was written by Coach Loop v121, newer than this release (v120). Some newer details may not appear here.");
  const dotted = parseBackupReview(JSON.stringify({ ...state, writtenByRelease: "v120.2" }));
  assert.equal(dotted.newerReleaseWarning, "This backup was written by Coach Loop v120.2, newer than this release (v120). Some newer details may not appear here.");
  const lower = parseBackupReview(JSON.stringify({ ...state, writtenByRelease: "v99" }));
  assert.equal(lower.newerReleaseWarning, null, "release numbers compare numerically");
  assert.equal(parseBackupReview(JSON.stringify(state)).newerReleaseWarning, null, "an unknown release does not warn");
});

test("legacy skipped plus completed cardio contributes no training or export evidence", () => {
  const workout = makeWorkout("lb", 90, "Skipped legacy activity");
  workout.status = "active";
  workout.date = "2026-10-31";
  workout.exercises = [];
  const activity = { ...makeCardio("run", "Skipped run"), skipped: true, completed: true, completedAsPlanned: true, actualDistanceKm: 8, actualDurationMin: 40, effort: "8", averageHr: 160, elevationM: 100, pace: "5:00/km" };
  activity.efforts = [{ ...makeActivityEffort(), completed: true, actualDistanceM: 8000, actualDurationSec: 2400 }];
  workout.cardio = [activity];
  workout.blockOrder = [{ type: "activity", id: activity.id }];
  assert.equal(hasCompletedActivityWork(activity), false);
  assert.equal(hasTrainingActivity(workout), false);
  assert.equal(hasTrainingEvidence(workout), false);
  assert.equal(hasGenuineTraining(workout), false);
  assert.equal(workoutProgressCopy(workout), "");
  assert.equal(activityHistoryLabel(activity), "Skipped");

  const state = finishWorkoutState({ ...defaultState(), workouts: [workout] }, workout, "2026-10-31T12:00:00.000Z");
  assert.equal(state.settings.firstWorkoutNote, undefined, "a skipped legacy activity does not trigger the first-workout gate");
  assert.equal(trainingWeekStreak(state, "2026-10-31").daysThisWeek, 0, "it does not count on the training calendar");
  const historyMarkup = renderToStaticMarkup(createElement(HistoryView, { state, onEdit: () => {}, onRepeat: () => {}, onReplan: () => {}, onDelete: () => {} }));
  assert.match(historyMarkup, /Skipped/);
  assert.doesNotMatch(historyMarkup, /8 km|40 min|160 bpm|100 m|5:00\/km|8\/10/);
  assert.doesNotMatch(workoutToText(state.workouts[0]), /8 km|40 min|8,000 m|Completed as prescribed/);
  assert.match(workoutToText(state.workouts[0]), /SKIPPED/);
  assert.doesNotMatch(exportCompletedHistory(state), /Skipped run/);
  const cardioRow = trainingCsvRows(state).find(row => row[3] === "run");
  assert.ok(cardioRow);
  assert.equal(cardioRow[2], "skipped");
  assert.equal(cardioRow[15], "");
  assert.equal(cardioRow[16], "");
  assert.deepEqual(cardioRow.slice(14, 21), ["", "", "", "", "", "", ""]);
  assert.equal(cardioRow[23], "");
});

test("AI guidance uses the single v1 interval and mobility formats", () => {
  for (const guidance of [FITLOG_V3_INSTRUCTIONS, FITLOG_V3_REMINDER, DEFAULT_COACH_PROFILE]) {
    assert.match(guidance, /mixed run\/walk[\s\S]*TYPE\|run/i);
    assert.match(guidance, /6 x \(3 min run \/ 1 min walk\)/);
    assert.match(guidance, /MOVE\|name\|prescription/);
    assert.match(guidance, /N x \.\.\.\/side or N x \.\.\. sec/);
  }
  assert.doesNotMatch(FITLOG_V3_INSTRUCTIONS, /INTERVALS\|[^\n]*×/);
  assert.doesNotMatch(FITLOG_V3_REMINDER, /INTERVALS\|[^\n]*×/);
});
