import assert from "node:assert/strict";
import test from "node:test";
import { matchedPreviousSetValues } from "../app/domain/training-workflow";
import { defaultState, localDate, makeSet, makeWorkout } from "../app/domain/training-types";
import { strengthProfile } from "../app/domain/strength-profile";
import { csvSetEffort, toCsv } from "../app/interchange/csv-export";

test("matching sets converts both ways and preserves accepted actuals and load meaning", () => {
  const previous = makeSet("lb", { completed: true, completedAsPlanned: true, actualWeight: 225, plannedWeight: 200, actualReps: "5", plannedReps: "3", loadType: "weighted", weightMode: "added", rir: "2" });
  const target = makeSet("kg");
  const matched = matchedPreviousSetValues(previous, target);
  assert.ok(Math.abs(matched.actualWeight! - 102.0583) < 0.0001);
  assert.equal(matched.actualReps, "5");
  assert.equal(matched.weightMode, "added");
  assert.equal(matched.rir, "2");
  assert.equal("unit" in matched, false);
  assert.ok(Math.abs(matchedPreviousSetValues(makeSet("kg", { actualWeight: 100 }), makeSet("lb")).actualWeight! - 220.4623) < 0.0001);
  assert.equal(matchedPreviousSetValues(makeSet("lb", { plannedWeight: 135 }), makeSet("lb")).actualWeight, 135);
  assert.equal(matchedPreviousSetValues(makeSet("lb", { loadType: "bodyweight" }), target).actualWeight, null);
});

test("CSV preserves and labels RIR and RPE", () => {
  assert.equal(csvSetEffort({ rpe: "", rir: "2" }), "RIR 2");
  assert.equal(csvSetEffort({ rpe: "8", rir: "" }), "RPE 8");
  assert.equal(csvSetEffort({ rpe: "8", rir: "2" }), "RPE 8; RIR 2");
  assert.equal(csvSetEffort({ rpe: "", rir: "" }), "");
  assert.equal(toCsv([[csvSetEffort({ rpe: "", rir: "2" })]]), '"RIR 2"');
});

test("bodyweight pull-up names work without treating chin-ups or assisted variants as pull-ups", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 90);
  workout.status = "completed";
  workout.date = localDate();
  workout.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "12", loadType: "bodyweight" })];
  state.workouts = [workout];
  for (const name of ["Pull-ups", "Strict Pull-ups", "Bodyweight Pull-ups", "Strict bodyweight pull-ups"]) {
    workout.exercises[0].name = name;
    assert.equal(strengthProfile(state, "lb").get("Pull-ups")?.value, 12, name);
  }
  for (const name of ["Strict chin-ups", "Assisted pull-ups", "Weighted pull-ups", "Kipping pull-ups"]) {
    workout.exercises[0].name = name;
    assert.equal(strengthProfile(state, "lb").has("Pull-ups"), false, name);
  }
  workout.exercises[0].name = "Pull-ups";
  workout.exercises[0].sets[0].loadType = "weighted";
  workout.exercises[0].sets[0].actualWeight = 25;
  assert.equal(strengthProfile(state, "lb").has("Pull-ups"), false);
});
