import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeSet, makeWorkout } from "../app/domain/training-types";
import { buildExerciseTrends } from "../app/domain/training-insights";
import { exerciseHistoryFor } from "../app/domain/exercise-history";

test("exercise history includes completed sets, warm-ups, and aliases but excludes plans", () => {
  const state = defaultState();
  state.exerciseAliases = { "Bench Press": "Barbell Bench Press" };
  const done = makeWorkout("lb", 90, "Upper day");
  done.status = "completed";
  done.exercises[0].name = "Bench Press";
  done.exercises[0].sets = [makeSet("lb", { warmup: true, completed: true, actualWeight: 135, actualReps: "5", loadType: "weighted" }), makeSet("lb", { completed: true, actualWeight: 185, actualReps: "6", loadType: "weighted" })];
  const planned = structuredClone(done);
  planned.id = "future-plan";
  planned.status = "planned";
  state.workouts = [done, planned];
  const series = buildExerciseTrends(state)[0];
  const history = exerciseHistoryFor(state, series.key);
  assert.equal(history.length, 1);
  assert.equal(history[0].workoutName, "Upper day");
  assert.match(history[0].sets[0], /warm-up/i);
  assert.match(history[0].sets[1], /185 lb.*6/);
});
