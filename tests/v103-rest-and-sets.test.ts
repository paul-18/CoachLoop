import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { nextRestTarget, setDisplayNumbers } from "../app/domain/completion";
import { makeCardio, makeExercise, makeSet, makeWorkout, defaultState } from "../app/domain/training-types";
import { PlanPreviewExercise } from "../app/views/today-view";
import { WorkoutEditor } from "../app/views/workout-editor";

test("rest_timer_next_advances_past_current_block", () => {
  const workout = makeWorkout("lb", 90, "Push");
  const first = workout.exercises[0];
  first.name = "Bench";
  first.sets = [makeSet("lb", { warmup: true }), makeSet("lb", { plannedReps: "5" })];
  first.sets[1].completed = true;
  const second = makeExercise("lb", 90, "Row");
  workout.exercises.push(second);
  workout.blockOrder.push({ type: "exercise", id: second.id });
  const next = nextRestTarget(workout, first.id, first.sets[1].id);
  assert.equal(next?.type, "exercise");
  if (next?.type === "exercise") {
    assert.equal(next.exercise.name, "Row");
    assert.notEqual(next.set.id, first.sets[0].id);
  }
});

test("rest_timer_next_skips_completed_and_skipped_blocks", () => {
  const workout = makeWorkout("lb", 60);
  const first = workout.exercises[0];
  first.sets = [makeSet("lb", { completed: true, actualReps: "5" })];
  const skipped = makeCardio("bike", "Ride");
  skipped.skipped = true;
  const later = makeExercise("lb", 60, "Squat");
  later.sets = [makeSet("lb", { completed: true, actualReps: "3" }), makeSet("lb", { skipped: true }), makeSet("lb", { plannedReps: "5" })];
  workout.exercises.push(later);
  workout.cardio = [skipped];
  workout.blockOrder = [
    { type: "exercise", id: first.id },
    { type: "activity", id: skipped.id },
    { type: "exercise", id: later.id },
  ];
  const next = nextRestTarget(workout, first.id, first.sets[0].id);
  assert.equal(next?.type, "exercise");
  if (next?.type === "exercise") {
    assert.equal(next.exercise.name, "Squat");
    assert.equal(next.set.id, later.sets[2].id);
  }
});

test("rest_timer_next_handles_no_remaining_blocks", () => {
  const workout = makeWorkout("lb", 60);
  const first = workout.exercises[0];
  first.sets = [makeSet("lb", { completed: true, actualReps: "5" })];
  const done = makeCardio("yoga", "Yoga");
  done.completed = true;
  workout.cardio = [done];
  workout.blockOrder = [{ type: "exercise", id: first.id }, { type: "activity", id: done.id }];
  assert.equal(nextRestTarget(workout, first.id, first.sets[0].id), undefined);
  const open = makeCardio("run", "Run");
  open.efforts = [{ id: "effort-1", plannedDistanceM: null, actualDistanceM: null, plannedDurationSec: null, actualDurationSec: null, plannedLoad: null, actualLoad: null, completed: false }];
  workout.cardio = [open];
  workout.blockOrder = [{ type: "activity", id: open.id }];
  const same = nextRestTarget(workout, open.id);
  assert.equal(same?.type, "activity");
  if (same?.type === "activity") assert.equal(same.activity.name, "Run");
});

test("preview_and_active_workout_use_consistent_set_numbering", () => {
  const labels = setDisplayNumbers([{ warmup: true }, { warmup: true }, { warmup: false }, { warmup: false }]);
  assert.deepEqual(labels.map((item) => item.label), ["W1", "W2", "Set 1", "Set 2"]);
  assert.deepEqual(labels.map((item) => item.short), ["W1", "W2", "1", "2"]);
  const workout = makeWorkout("lb", 90, "Push");
  workout.exercises[0].name = "Bench";
  workout.exercises[0].sets = [
    makeSet("lb", { warmup: true, plannedReps: "10", plannedWeight: 45 }),
    makeSet("lb", { warmup: true, plannedReps: "5", plannedWeight: 95 }),
    makeSet("lb", { plannedReps: "5", plannedWeight: 135 }),
    makeSet("lb", { plannedReps: "5", plannedWeight: 155 }),
  ];
  const before = structuredClone(workout.exercises[0].sets);
  const editor = renderToStaticMarkup(createElement(WorkoutEditor, {
    workout, state: defaultState(), saveStatus: "saved", onUpdate: () => {}, onFinish: async () => {}, onBack: () => {}, onIncrement: () => {},
  }));
  const preview = renderToStaticMarkup(createElement(PlanPreviewExercise, { exercise: workout.exercises[0] }));
  for (const markup of [editor, preview]) {
    assert.match(markup, /W1/);
    assert.match(markup, /W2/);
    assert.match(markup, /Set 1/);
    assert.match(markup, /Set 2/);
    assert.doesNotMatch(markup, /Set 3/);
  }
  assert.deepEqual(workout.exercises[0].sets, before);
});
