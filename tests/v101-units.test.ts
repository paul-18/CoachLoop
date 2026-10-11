import test from "node:test";
import assert from "node:assert/strict";
import { defaultState } from "../app/domain/training-types";
import { goalsAreStarter } from "../app/views/goal-examples";
import { starterPlanState } from "../app/views/starter-plan";

test("kilogram logs get a 100 kg bench goal and practical barbell loads", () => {
  const state = defaultState();
  state.settings.defaultUnit = "kg";
  const started = starterPlanState(state);
  assert.deepEqual(started.goals, ["Bench press 100 kg", "Run a 5k under 30 minutes"]);
  assert.equal(goalsAreStarter(started.goals, "kg"), true);
  assert.equal(goalsAreStarter(["Stay healthy"], "kg"), false);
  const bench = started.workouts[0]?.exercises[0];
  assert.deepEqual(bench?.sets.map(set => set.plannedWeight), [20, 60, 70, 75, 80, 85]);
  assert.ok(bench?.sets.every(set => set.unit === "kg"));
  const raise = started.workouts[0]?.exercises[3]?.sets[0];
  assert.equal(raise?.plannedWeight, 4);
  assert.equal(raise?.weightMode, "per_hand");
  assert.equal(raise?.unit, "kg");
});

test("pound logs keep the 225 lb starter", () => {
  const started = starterPlanState(defaultState());
  assert.deepEqual(started.goals, ["Bench press 225 lb", "Run a 5k under 30 minutes"]);
  assert.deepEqual(started.workouts[0]?.exercises[0]?.sets.map(set => set.plannedWeight), [45, 135, 155, 175, 185]);
});
