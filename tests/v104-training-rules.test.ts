import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { completedSetValues, parseExactReps } from "../app/domain/completion";
import { strengthRecords, workoutLiftingVolume } from "../app/domain/training-metrics";
import { defaultState, makeExercise, makeSet, makeWorkout } from "../app/domain/training-types";

const rules = JSON.parse(readFileSync(fileURLToPath(new URL("../docs/maintenance/training-rules-v1.json", import.meta.url)), "utf8"));

test("shared_training_rules_actual_reps_match_fixture", () => {
  for (const vector of rules.actualReps) {
    assert.equal(parseExactReps(vector.input), vector.value, vector.input);
  }
});

test("shared_training_rules_completion_matches_fixture", () => {
  for (const vector of rules.completion) {
    const set = makeSet("lb", {
      plannedReps: vector.plannedReps,
      actualReps: vector.actualReps,
      plannedWeight: vector.plannedWeight,
      actualWeight: vector.actualWeight,
      loadType: "weighted",
    });
    if (!vector.completes) {
      assert.throws(() => completedSetValues(set), /Enter the reps you performed/, vector.name);
      continue;
    }
    assert.deepEqual(completedSetValues(set), {
      actualReps: vector.expectedActualReps,
      actualWeight: vector.expectedActualWeight,
      completedAsPlanned: vector.expectedAsPlanned,
    }, vector.name);
  }
});

test("shared_training_rules_volume_matches_fixture", () => {
  for (const vector of rules.volume) {
    const set = makeSet("lb", {
      completed: vector.completed,
      warmup: vector.warmup,
      skipped: vector.skipped,
      loadType: vector.loadType,
      weightMode: vector.weightMode,
      actualReps: vector.actualReps,
      actualWeight: vector.actualWeight,
    });
    const exercise = makeExercise("lb", 60);
    exercise.sets = [set];
    const workout = makeWorkout("lb", 60);
    workout.exercises = [exercise];
    const result = workoutLiftingVolume(workout, "lb");
    assert.equal(result.volume, vector.expectedVolume, vector.name);
    assert.equal(result.countedSets, vector.expectedCountedSets, vector.name);
    assert.equal(result.excludedSets, vector.expectedExcludedSets, vector.name);
  }
});

test("fractional_legacy_reps_do_not_create_a_strength_record", () => {
  const workout = makeWorkout("lb", 60);
  workout.status = "completed";
  workout.exercises[0].name = "Barbell Bench Press";
  workout.exercises[0].sets = [makeSet("lb", {
    completed: true,
    loadType: "weighted",
    weightMode: "total",
    actualReps: "5.5",
    actualWeight: 200,
  })];
  const state = defaultState();
  state.workouts = [workout];
  assert.equal(strengthRecords(state, "lb").size, 0);
  workout.exercises[0].sets[0].actualReps = "5";
  assert.equal(strengthRecords(state, "lb").size, 1);
});
