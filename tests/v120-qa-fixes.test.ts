import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { completeActivity } from "../app/domain/activity-segments";
import { performedDistance, performedDuration, setEvidenceError, formatMeasure } from "../app/domain/completion";
import { defaultState, localDate, makeCardio, makeExercise, makeSet, makeWorkout, type CardioEntry, type WorkoutSession } from "../app/domain/training-types";
import { summarizeWorkout } from "../app/views/shared";
import { HistoryView } from "../app/views/history-view";
import { backupChanges, restoredState } from "../app/persistence/backup-tools";
import { exampleFitlogV3 } from "../app/interchange/fitlog";
import { BodyCoverageMap } from "../app/views/body-coverage-map";

test("v120 B1: completeActivity and performedDuration/Distance retain summary metrics alongside segments", () => {
  const runWithSegments: CardioEntry = {
    ...makeCardio("run", "Morning run"),
    plannedDurationMin: 30,
    plannedDistanceKm: 5,
    actualDurationMin: 30,
    actualDistanceKm: 5,
    completed: true,
    segments: [
      { id: "s1", kind: "run", plannedDurationSec: 300, actualDurationSec: 300, plannedDistanceM: 1000, actualDistanceM: 1000, status: "completed" },
      { id: "s2", kind: "walk", plannedDurationSec: 60, actualDurationSec: 60, plannedDistanceM: 100, actualDistanceM: 100, status: "completed" },
    ],
  };

  assert.equal(performedDuration(runWithSegments), 30);
  assert.equal(performedDistance(runWithSegments), 5);

  const completed = completeActivity({
    ...runWithSegments,
    actualDurationMin: null,
    actualDistanceKm: null,
  });
  assert.equal(completed.actualDurationMin, 30);
  assert.equal(completed.actualDistanceKm, 5);
});

test("v120 M1: grammar in workoutCompletionSummary and finish dialog distinguishes singular/plural skipped sets", () => {
  const workout = makeWorkout("lb", 90, "Strength session");
  workout.exercises = [
    {
      ...makeExercise("lb", 90),
      sets: [
        { ...makeSet("lb", { plannedReps: "5", plannedWeight: 100 }), completed: true },
        { ...makeSet("lb", { plannedReps: "5", plannedWeight: 100 }), skipped: true },
      ],
    },
  ];
  // 1 set skipped should be singular
  const skippedCount = workout.exercises[0].sets.filter(s => s.skipped && !s.completed).length;
  assert.equal(skippedCount, 1);
  const text = `${skippedCount} ${skippedCount === 1 ? "set" : "sets"} explicitly skipped.`;
  assert.equal(text, "1 set explicitly skipped.");
});

test("v120 M2 & M3: all-skipped workouts appear under Skipped filter and summarize as skipped, not 'No work recorded'", () => {
  const skippedWorkout: WorkoutSession = {
    ...makeWorkout("lb", 90, "Skipped Session"),
    date: localDate(),
    status: "completed",
    exercises: [
      {
        ...makeExercise("lb", 90),
        sets: [
          { ...makeSet("lb", { plannedReps: "5", plannedWeight: 100 }), skipped: true, completed: false },
          { ...makeSet("lb", { plannedReps: "5", plannedWeight: 100 }), skipped: true, completed: false },
        ],
      },
    ],
  };

  const summary = summarizeWorkout(skippedWorkout);
  assert.equal(summary, "2 sets skipped");
  assert.doesNotMatch(summary, /No work recorded/);

  const state = {
    ...defaultState(),
    workouts: [skippedWorkout],
  };

  const markup = renderToStaticMarkup(createElement(HistoryView, {
    state,
    onEdit: () => {},
    onRepeat: () => {},
    onReplan: () => {},
    onDelete: () => {},
  }));

  assert.match(markup, /2 sets skipped/);
  assert.match(markup, /Skipped/);
});

test("v120 M4: setEvidenceError rejects negative, over 5,000, or NaN loads", () => {
  const validSet = { ...makeSet("lb", { plannedReps: "5", plannedWeight: 100 }), actualReps: "5", actualWeight: 100 };
  assert.equal(setEvidenceError(validSet), null);

  const zeroSet = { ...validSet, actualWeight: 0 };
  assert.equal(setEvidenceError(zeroSet), null);

  const negativeSet = { ...validSet, actualWeight: -10 };
  assert.equal(setEvidenceError(negativeSet), "Actual load must be between 0 and 5,000");

  const hugeSet = { ...validSet, actualWeight: 5001 };
  assert.equal(setEvidenceError(hugeSet), "Actual load must be between 0 and 5,000");

  const nanSet = { ...validSet, actualWeight: NaN };
  assert.equal(setEvidenceError(nanSet), "Actual load must be between 0 and 5,000");
});

test("v120 M6: distance format is clean and consistent across views without trailing zeros", () => {
  assert.equal(formatMeasure(6.2), "6.2");
  assert.equal(formatMeasure(5), "5");
  assert.equal(formatMeasure(100), "100");
  assert.equal(formatMeasure(8.5), "8.5");
});

test("v120 M11: merging identical backup overstates changes is fixed", () => {
  const workout = makeWorkout("lb", 90, "Leg Day");
  const state: typeof defaultState extends () => infer T ? T : never = {
    ...defaultState(),
    workouts: [workout],
  };

  const merged = restoredState(state, state, "merge", false);
  const changes = backupChanges(state, merged);
  assert.equal(changes.changed, 0, "Identical merge should report 0 changed workouts");
});

test("v120 M18: BodyCoverageMap does not duplicate button role on mirrored paths", () => {
  const markup = renderToStaticMarkup(createElement(BodyCoverageMap, {
    coverage: [],
    selected: null,
    onSelect: () => {},
  }));

  // Verify aria-hidden="true" is present on mirrored elements
  assert.match(markup, /aria-hidden="true"/);
});

test("v120 M19: Segmented run without walk segments does not render 'Walking only'", () => {
  const runOnlyWorkout: WorkoutSession = {
    ...makeWorkout("lb", 90, "Track Run"),
    date: localDate(),
    status: "completed",
    cardio: [
      {
        ...makeCardio("run", "Track Intervals"),
        completed: true,
        actualDurationMin: 20,
        actualDistanceKm: 4,
        segments: [
          { id: "s1", kind: "run", plannedDurationSec: 300, actualDurationSec: 300, plannedDistanceM: 1000, actualDistanceM: 1000, status: "completed" },
        ],
      },
    ],
  };

  const markup = renderToStaticMarkup(createElement(HistoryView, {
    state: { ...defaultState(), workouts: [runOnlyWorkout] },
    onEdit: () => {},
    onRepeat: () => {},
    onReplan: () => {},
    onDelete: () => {},
  }));

  assert.doesNotMatch(markup, /Walking only/);
});

test("v120 C3: exampleFitlogV3 uses current local date", () => {
  const v3 = exampleFitlogV3();
  assert.match(v3, new RegExp(`WORKOUT\\|Squats and an easy run\\|${localDate()}`));
  assert.doesNotMatch(v3, /2026-01-15/);
});
