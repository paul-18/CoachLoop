import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WEEKLY_CARDS } from "../app/domain/display-preferences";
import { weeklyCards } from "../app/domain/weekly-cards";
import { defaultState, makeCardio, makeWorkout } from "../app/domain/training-types";
import { prepareLoadedState } from "../app/persistence/migrations";

test("Last 7 days leaves water polo off the default cards without dropping history", () => {
  assert.equal(DEFAULT_WEEKLY_CARDS.includes("water_polo"), false);
  const state = defaultState();
  const workout = makeWorkout("lb", 30);
  workout.status = "completed";
  workout.completedAt = "2026-10-01T12:00:00.000Z";
  workout.date = "2026-10-01";
  const activity = makeCardio("water_polo");
  activity.completed = true;
  activity.actualDurationMin = 45;
  workout.exercises = [];
  workout.cardio = [activity];
  workout.blockOrder = [{ type: "activity", id: activity.id }];
  state.workouts = [workout];
  const loaded = prepareLoadedState(JSON.parse(JSON.stringify(state)));
  assert.equal(loaded.workouts[0]?.cardio[0]?.activityType, "water_polo");
  assert.equal(loaded.workouts[0]?.cardio[0]?.actualDurationMin, 45);
  assert.equal(weeklyCards(loaded).some(card => card.id === "water_polo"), false);
  loaded.settings.weeklyCards = ["water_polo"];
  assert.equal(weeklyCards(loaded)[0]?.id, "water_polo");
});
