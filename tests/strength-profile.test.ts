import assert from "node:assert/strict";
import test from "node:test";
import { strengthProfile } from "../app/domain/strength-profile";
import { defaultState, localDate, makeSet, makeWorkout } from "../app/domain/training-types";

test("strength profile uses only comparable completed sets and respects corrected dates", () => {
  const state = defaultState();
  const bench = makeWorkout("lb", 90);
  bench.status = "completed";
  bench.date = localDate();
  bench.exercises[0].name = "Barbell Bench Press";
  bench.exercises[0].sets = [
    makeSet("lb", { completed: true, actualWeight: 185, actualReps: "6", loadType: "weighted" }),
    makeSet("lb", { completed: true, warmup: true, actualWeight: 300, actualReps: "1", loadType: "weighted" }),
    makeSet("lb", { plannedWeight: 400, plannedReps: "1", loadType: "weighted" }),
  ];
  const squat = makeWorkout("lb", 90);
  squat.status = "completed";
  squat.date = "2020-01-01";
  squat.exercises[0].name = "Back Squat";
  squat.exercises[0].sets = [makeSet("lb", { completed: true, actualWeight: 275, actualReps: "1", loadType: "weighted" })];
  state.workouts = [bench, squat];
  assert.equal(Math.round(strengthProfile(state, "lb").get("Bench press")!.value), 222);
  assert.equal(strengthProfile(state, "lb").has("Squat"), false);
  squat.date = localDate();
  assert.equal(Math.round(strengthProfile(state, "lb").get("Squat")!.value), 284);
});
