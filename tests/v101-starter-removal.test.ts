import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeWorkout } from "../app/domain/training-types";
import { removeStarterState, starterPlanState } from "../app/views/starter-plan";

test("removing the starter keeps a quick-log list the user changed", () => {
  const started = starterPlanState(defaultState());
  started.settings.quickLogActivities = ["run", "swim"];
  const removed = removeStarterState(started);
  assert.deepEqual(removed.settings.quickLogActivities, ["run", "swim"]);
  assert.equal(removed.workouts.length, 0);
});

test("removing the starter keeps an untouched quick-log list instead of restoring every activity", () => {
  const started = starterPlanState(defaultState());
  const removed = removeStarterState(started);
  assert.deepEqual(removed.settings.quickLogActivities, ["run", "bike", "circuit", "yoga"]);
});

test("an edited profile stays when the starter session is removed", () => {
  const started = starterPlanState(defaultState());
  started.coachProfile = "My own notes";
  const extra = makeWorkout("lb", 20);
  extra.name = "Saturday run";
  started.workouts = [...started.workouts, extra];
  const removed = removeStarterState(started);
  assert.equal(removed.coachProfile, "My own notes");
  assert.deepEqual(removed.workouts.map(workout => workout.name), ["Saturday run"]);
});
