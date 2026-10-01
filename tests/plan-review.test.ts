import test from "node:test";
import assert from "node:assert/strict";
import { makeCardio, makeSet, makeWorkout } from "../app/domain/training-types";
import { planDifferences, reschedulePlannedWorkout } from "../app/domain/plan-review";

test("rescheduling changes only a valid saved plan date", () => {
  const plan = makeWorkout("lb", 120, "Bench day");
  plan.status = "planned";
  plan.date = "2026-09-29";
  const moved = reschedulePlannedWorkout(plan, "2026-10-03", "2026-09-29T20:00:00Z");
  assert.equal(moved.date, "2026-10-03");
  assert.equal(moved.status, "planned");
  assert.equal(moved.exercises[0].id, plan.exercises[0].id);
  assert.equal(plan.date, "2026-09-29");
  assert.throws(() => reschedulePlannedWorkout(plan, "2026-02-30", "now"));
  assert.throws(() => reschedulePlannedWorkout({ ...plan, status: "completed" }, "2026-10-03", "now"));
});

test("finish review shows only performed deviations from prescriptions", () => {
  const workout = makeWorkout("lb", 120, "Bench and bike");
  workout.exercises[0].name = "Bench Press";
  workout.exercises[0].sets = [
    makeSet("lb", { plannedWeight: 175, plannedReps: "6", actualWeight: 185, actualReps: "6", completed: true, loadType: "weighted" }),
    makeSet("lb", { plannedWeight: 175, plannedReps: "6", actualWeight: 175, actualReps: "6", completed: true, loadType: "weighted" }),
    makeSet("lb", { plannedWeight: 175, plannedReps: "6", completed: false, loadType: "weighted" }),
  ];
  const bike = makeCardio("bike", "Easy bike");
  bike.completed = true;
  bike.plannedDurationMin = 10;
  bike.actualDurationMin = 12;
  workout.cardio = [bike];
  assert.deepEqual(planDifferences(workout), ["Bench Press · Set 1: 175 lb × 6 → 185 lb × 6", "Easy bike: 10 min → 12 min"]);
});
