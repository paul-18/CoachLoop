import test from "node:test";
import assert from "node:assert/strict";
import { APP_RELEASE } from "../app/app-release";
import {
  makeWorkout,
  makeCardio,
  type CardioEntry,
} from "../app/domain/training-types";
import { makeActivityEffort } from "../app/domain/activity-logging";
import {
  performedDuration,
  performedDistance,
  workoutProgressCopy,
} from "../app/domain/completion";
import { weeklyCards } from "../app/domain/weekly-cards";
import { defaultState } from "../app/domain/training-types";
import { parseFitlog, exampleSafeImportFitlog } from "../app/interchange/fitlog";
import { storedStateBoundary } from "../app/persistence/training-validation";

test("v120: APP_RELEASE is v120", () => {
  assert.equal(APP_RELEASE, "v120");
});

test("v118 (P1): performedDuration and performedDistance return null when any completed effort is missing measurements", () => {
  const effort1 = { ...makeActivityEffort(), plannedDistanceM: 20, actualDistanceM: 20, actualDurationSec: 30, completed: true };
  const effort2 = { ...makeActivityEffort(), plannedDistanceM: 20, actualDistanceM: null, actualDurationSec: 35, completed: true };
  const effort3 = { ...makeActivityEffort(), plannedDistanceM: 20, actualDistanceM: 20, actualDurationSec: null, completed: true };

  const activityWithMissingDistance: CardioEntry = {
    ...makeCardio("force"),
    loggingStyle: "efforts",
    efforts: [effort1, effort2],
  };

  const activityWithMissingDuration: CardioEntry = {
    ...makeCardio("force"),
    loggingStyle: "efforts",
    efforts: [effort1, effort3],
  };

  const completeActivity: CardioEntry = {
    ...makeCardio("force"),
    loggingStyle: "efforts",
    efforts: [effort1],
  };

  // Missing distance on effort2 -> performedDistance must be null (not partial 0.02 km)
  assert.equal(performedDistance(activityWithMissingDistance), null);
  // Complete effort1 duration is present -> performedDuration succeeds
  assert.ok(Math.abs(performedDuration(activityWithMissingDistance)! - 65 / 60) < 1e-6);

  // Missing duration on effort3 -> performedDuration must be null (not partial)
  assert.equal(performedDuration(activityWithMissingDuration), null);
  // Complete effort1 and effort3 distance is present -> performedDistance succeeds
  assert.equal(performedDistance(activityWithMissingDuration), 40 / 1000);

  // All measured -> both return valid totals
  assert.equal(performedDistance(completeActivity), 20 / 1000);
  assert.equal(performedDuration(completeActivity), 30 / 60);
});

test("v118 (D2): skipping sets includes clear skipped qualifier in workoutProgressCopy", () => {
  const workout = makeWorkout("lb", 120);
  // Initially 0/3 sets
  assert.equal(workoutProgressCopy(workout), "0/3 sets");

  // Skip set 1
  workout.exercises[0].sets[0].skipped = true;
  assert.equal(workoutProgressCopy(workout), "0/2 sets · 1 skipped");

  // Complete set 2
  workout.exercises[0].sets[1].completed = true;
  workout.exercises[0].sets[1].actualReps = "5";
  workout.exercises[0].sets[1].actualWeight = 135;
  assert.equal(workoutProgressCopy(workout), "1/2 sets · 1 skipped");

  // Skip set 3 as well
  workout.exercises[0].sets[2].skipped = true;
  assert.equal(workoutProgressCopy(workout), "1/1 set · 2 skipped");

  // Unskip set 1
  workout.exercises[0].sets[0].skipped = false;
  assert.equal(workoutProgressCopy(workout), "1/2 sets · 1 skipped");
});

test("v118 (D6): unrecorded circuit duration never formats as '0 min'", () => {
  const state = defaultState();
  state.settings.weeklyCards = ["circuit"];
  const workout = makeWorkout("lb", 120);
  workout.status = "completed";
  const circuit = makeCardio("circuit", "Station Circuit");
  circuit.completed = true;
  circuit.actualDurationMin = null;
  workout.cardio = [circuit];
  workout.exercises = [];
  state.workouts = [workout];

  const cards = weeklyCards(state);
  const circuitCard = cards.find(c => c.id === "circuit");
  assert.ok(circuitCard, "Circuit card is present");
  assert.ok(!circuitCard.detail.includes("0 min"), "Detail must not say 0 min when unrecorded");
  assert.ok(circuitCard.detail.includes("time not recorded"), "Honest qualifier present");
});

test("v118 (P2): FITLOG rejects numbers above realistic upper bounds", () => {
  // Distance > 1000 km
  assert.throws(
    () => parseFitlog("[FITLOG:3]\nWORKOUT|Test|2026-03-01\nCARDIO|Run\nMODE|summary\nDISTANCE|1200\n[/FITLOG]"),
    /maximum supported value is 1000/
  );

  // Duration > 10080 min
  assert.throws(
    () => parseFitlog("[FITLOG:3]\nWORKOUT|Test|2026-03-01\nCARDIO|Run\nMODE|summary\nDURATION|20000\n[/FITLOG]"),
    /maximum supported value is 10080/
  );

  // Load > 5000 lb
  assert.throws(
    () => parseFitlog("[FITLOG:3]\nWORKOUT|Test|2026-03-01\nEXERCISE|Squat\nSET|5|99999 lb total\n[/FITLOG]"),
    /SET load must be between 0 and 5000/
  );

  // Reps > 5000
  assert.throws(
    () => parseFitlog("[FITLOG:3]\nWORKOUT|Test|2026-03-01\nEXERCISE|Push-up\nSET|99999|BW\n[/FITLOG]"),
    /reps must not exceed 5000/
  );
});

test("v118 (Task 4.2): truncated FITLOG block provides actionable diagnostic error", () => {
  const truncated = `[FITLOG:3]
WORKOUT|Long Run|2026-03-01
RUN|10 km · 60 min`;

  assert.throws(
    () => parseFitlog(truncated),
    (err: Error) => {
      return (
        err.message.includes("Incomplete FITLOG block: missing closing [/FITLOG] tag") &&
        err.message.includes("ask your AI to output the complete block")
      );
    }
  );
});

test("v118 (Task 4.1): exampleSafeImportFitlog uses canonical FITLOG:3 format", () => {
  const example = exampleSafeImportFitlog("lb");
  assert.ok(example.startsWith("[FITLOG:3]"), "example starts with [FITLOG:3]");
  assert.ok(example.includes("[/FITLOG]"), "example has closing [/FITLOG]");
  assert.ok(example.includes("MODE|summary"), "cardio has MODE|summary");
  assert.ok(example.includes("EXERCISE|Leg Press"), "example includes leg press");

  // Parses cleanly into a workout session
  const parsed = parseFitlog(example);
  assert.ok(parsed.id);
  assert.equal(parsed.source, "fitlog");
  assert.ok(parsed.exercises.length >= 2);
});

test("v118 (P2): storedStateBoundary enforces bounded numbers on stored data", () => {
  const workout = makeWorkout("lb", 120);
  workout.exercises[0].sets[0].actualWeight = 999999;

  const invalidState = {
    workouts: [workout],
    deletedWorkoutIds: [],
    customExercises: [],
    exerciseAliases: {},
    exerciseNotes: {},
    goals: [],
    coachProfile: "",
    bodyweightEntries: [],
    waistEntries: [],
    benchmarks: [],
    exerciseMuscleOverrides: {},
    scheduleContext: { events: [], phases: [] },
    settings: {
      defaultUnit: "lb" as const,
      defaultRestSec: 120,
      barWeightLb: 45,
      barWeightKg: 20,
      lastBackupAt: null,
    },
  };

  const result = storedStateBoundary.safeParse(invalidState);
  assert.equal(result.success, false, "Schema rejects load above 5000");
});
