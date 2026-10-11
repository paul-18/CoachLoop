import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeSet, makeWorkout } from "../app/domain/training-types";
import { finishWorkoutState } from "../app/domain/workout-transitions";
import { FITLOG_EXAMPLE_SNIPPET, parseFitlog } from "../app/interchange/fitlog";
import { storedStateBoundary } from "../app/persistence/training-validation";
import { removeStarterState, starterPlanState, starterRemovable } from "../app/views/starter-plan";

test("the short FITLOG example is valid and does not log a result", () => {
  const workout = parseFitlog(FITLOG_EXAMPLE_SNIPPET, "lb", {});
  assert.equal(workout.exercises[0]?.name, "Barbell Bench Press");
  assert.equal(workout.exercises[0]?.sets[0]?.plannedWeight, 135);
  assert.ok(workout.exercises.every(exercise => exercise.sets.every(set => !set.completed && !set.actualReps)));
});

test("removing the starter keeps unrelated workouts and edited goals", () => {
  const started = starterPlanState(defaultState());
  const kept = makeWorkout("lb", 100);
  kept.name = "My own workout";
  const withExtra = { ...started, workouts: [...started.workouts, kept], goals: ["Stay healthy"] };
  assert.equal(starterRemovable(withExtra), true);
  const removed = removeStarterState(withExtra);
  assert.deepEqual(removed.workouts.map(workout => workout.name), ["My own workout"]);
  assert.deepEqual(removed.goals, ["Stay healthy"]);
  assert.equal(removed.coachProfile, "");
  assert.equal(removed.settings.welcomeChoice, undefined);
  assert.ok(removed.deletedWorkoutIds.includes(started.workouts[0].id));
});

test("a started starter session is not deleted", () => {
  const started = starterPlanState(defaultState());
  started.workouts[0].status = "active";
  assert.equal(starterRemovable(started), false);
  assert.equal(removeStarterState(started), started);
});

test("the first real completion shows one note, and a skip does not", () => {
  const state = starterPlanState(defaultState());
  const skipped = { ...state.workouts[0], status: "skipped" as const, skippedAt: new Date().toISOString() };
  const afterSkip = { ...state, workouts: [skipped] };
  assert.equal(afterSkip.settings.firstWorkoutNote, undefined);
  const real = makeWorkout("lb", 80);
  real.status = "active";
  real.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5", actualWeight: 135, plannedWeight: 135 })];
  const finished = finishWorkoutState({ ...state, workouts: [...state.workouts, real] }, real);
  assert.equal(finished.settings.firstWorkoutNote, "show");
  const second = makeWorkout("lb", 60);
  second.id = "second-workout";
  second.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "8", actualWeight: 95, plannedWeight: 95 })];
  const dismissed = { ...finished, settings: { ...finished.settings, firstWorkoutNote: "dismissed" as const }, workouts: [...finished.workouts, second] };
  assert.equal(finishWorkoutState(dismissed, second).settings.firstWorkoutNote, "dismissed");
  const empty = makeWorkout("lb", 40);
  empty.id = "empty-workout";
  const unfinished = finishWorkoutState({ ...state, workouts: [...state.workouts, empty] }, empty);
  assert.equal(unfinished.settings.firstWorkoutNote, undefined);
  const roundTrip = storedStateBoundary.parse(finished);
  assert.equal(roundTrip.settings.firstWorkoutNote, "show");
  assert.equal(roundTrip.workouts.find(workout => workout.starterSeed)?.status, "planned");
});
