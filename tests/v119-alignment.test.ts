import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { APP_RELEASE } from "../app/app-release";
import { exerciseProgressCopy, workoutProgressCopy } from "../app/domain/completion";
import { defaultState, makeWorkout, makeCardio } from "../app/domain/training-types";
import { makeActivityEffort } from "../app/domain/activity-logging";
import { planDifferences } from "../app/domain/plan-review";
import { parseFitlog } from "../app/interchange/fitlog";
import { weeklyCards } from "../app/domain/weekly-cards";

test("v122: APP_RELEASE is v122", () => {
  assert.equal(APP_RELEASE, "v122");
});

test("v119 (Task 1): exerciseProgressCopy and workoutProgressCopy stay synchronized with active denominator and skipped qualifiers", () => {
  const workout = makeWorkout("lb", 120);
  workout.exercises = [{
    id: "ex-1",
    name: "Barbell Bench Press",
    restSec: 120,
    notes: "",
    coachNotes: "",
    sets: [
      { id: "s-1", warmup: false, loadType: "weighted", weightMode: "total", unit: "lb", plannedReps: "5", actualReps: "5", plannedWeight: 135, actualWeight: 135, plannedRpe: "", plannedRir: "", rpe: "", rir: "", notes: "", completed: true, completedAsPlanned: true, skipped: false, updatedAt: "" },
      { id: "s-2", warmup: false, loadType: "weighted", weightMode: "total", unit: "lb", plannedReps: "5", actualReps: "5", plannedWeight: 135, actualWeight: 135, plannedRpe: "", plannedRir: "", rpe: "", rir: "", notes: "", completed: true, completedAsPlanned: true, skipped: false, updatedAt: "" },
      { id: "s-3", warmup: false, loadType: "weighted", weightMode: "total", unit: "lb", plannedReps: "5", actualReps: "5", plannedWeight: 135, actualWeight: 135, plannedRpe: "", plannedRir: "", rpe: "", rir: "", notes: "", completed: false, completedAsPlanned: false, skipped: true, updatedAt: "" },
    ],
    updatedAt: "",
  }];

  // 2 done, 1 skipped out of 3
  const cardSummary = exerciseProgressCopy(workout.exercises[0].sets);
  const headerSummary = workoutProgressCopy(workout);

  assert.equal(cardSummary, "2/2 sets · 1 skipped");
  assert.equal(headerSummary, "2/2 sets · 1 skipped");

  // 0 done, 1 skipped out of 3
  workout.exercises[0].sets[0].completed = false;
  workout.exercises[0].sets[1].completed = false;
  assert.equal(exerciseProgressCopy(workout.exercises[0].sets), "0/2 sets · 1 skipped");
  assert.equal(workoutProgressCopy(workout), "0/2 sets · 1 skipped");

  // All 3 skipped
  workout.exercises[0].sets[0].skipped = true;
  workout.exercises[0].sets[1].skipped = true;
  assert.equal(exerciseProgressCopy(workout.exercises[0].sets), "0 sets · 3 skipped");
  assert.equal(workoutProgressCopy(workout), "0 sets · 3 skipped");

  // None skipped (0 done of 3)
  workout.exercises[0].sets.forEach(s => { s.skipped = false; s.completed = false; });
  assert.equal(exerciseProgressCopy(workout.exercises[0].sets), "0/3 sets");
  assert.equal(workoutProgressCopy(workout), "0/3 sets");
});

test("v119 (Task 3): planDifferences cleanly rounds fractional minutes without raw repeating IEEE-754 decimals", () => {
  const workout = makeWorkout("lb", 120);
  const circuit = makeCardio("circuit");
  circuit.name = "Circuit rounds";
  circuit.completed = true;
  circuit.segments = [
    {
      id: "seg-1",
      kind: "other",
      plannedDurationSec: 40, // 40 seconds = 0.6666666666666666 minutes
      actualDurationSec: null, // incomplete
      plannedDistanceM: null,
      actualDistanceM: null,
      status: "modified",
    },
  ];
  workout.cardio = [circuit];

  const diffs = planDifferences(workout);
  assert.equal(diffs.length, 1);
  assert.ok(diffs[0].includes("0.67 min"), `Expected cleanly rounded duration, got: ${diffs[0]}`);
  assert.ok(!diffs[0].includes("0.6666666666666666"), "Must not leak raw repeating decimal into plan differences");
});

test("v119 (Task 4): weeklyCards omits '0 km' when distance is flagged as unrecorded", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 90);
  workout.status = "completed";
  const force = makeCardio("force");
  // 4 efforts: 3 recorded, 1 missing distance
  force.efforts = [
    { ...makeActivityEffort(), plannedDistanceM: 20, actualDistanceM: 20, actualDurationSec: 30, completed: true },
    { ...makeActivityEffort(), plannedDistanceM: 20, actualDistanceM: 20, actualDurationSec: 30, completed: true },
    { ...makeActivityEffort(), plannedDistanceM: 20, actualDistanceM: 20, actualDurationSec: 30, completed: true },
    { ...makeActivityEffort(), plannedDistanceM: 20, actualDistanceM: null, actualDurationSec: 30, completed: true },
  ];
  force.completed = true;
  workout.cardio = [force];
  state.workouts = [workout];
  state.settings.weeklyCards = ["force"];

  const cards = weeklyCards(state);
  const forceCard = cards.find(c => c.id === "force");
  assert.ok(forceCard);
  assert.ok(forceCard.detail.includes("distance not fully recorded"));
  assert.ok(!forceCard.detail.includes("0 km"), `Must omit 0 km prefix, got: ${forceCard.detail}`);
});

test("v119 (Task 5): README.md FITLOG example uses valid WORKOUT|name|date format and parses with 0 warnings", () => {
  const readmePath = path.resolve(process.cwd(), "README.md");
  const readmeContent = fs.readFileSync(readmePath, "utf-8");

  // Extract the fenced FITLOG block from README
  const match = readmeContent.match(/```text\s*(\[FITLOG:3\][\s\S]*?\[\/FITLOG\])\s*```/);
  assert.ok(match, "README.md must contain a fenced [FITLOG:3] text block");

  const fitlogText = match[1];

  // Verify WORKOUT| line has name first, date second
  const workoutLine = fitlogText.split("\n").find(line => line.startsWith("WORKOUT|"));
  assert.ok(workoutLine, "Block must contain a WORKOUT| line");

  const parts = workoutLine.split("|");
  assert.equal(parts.length, 3, "WORKOUT line must have 3 parts (WORKOUT|name|YYYY-MM-DD)");
  assert.match(parts[2].trim(), /^\d{4}-\d{2}-\d{2}$/, "Third part must be ISO date");
  assert.ok(!/^\d{4}-\d{2}-\d{2}$/.test(parts[1].trim()), "Second part must be workout name, not date");

  // Parse using parseFitlog
  const parsed = parseFitlog(fitlogText);
  assert.ok(parsed.id);
  assert.equal(parsed.name, "Example strength and easy run");
  assert.equal(parsed.date, "2026-11-01");
  assert.equal((parsed.importWarnings ?? []).length, 0, `Expected 0 warnings, got: ${JSON.stringify(parsed.importWarnings)}`);
});
