import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultState,
  localDate,
  makeExercise,
  makeSet,
  makeWorkout,
  type WorkoutSession,
} from "../app/domain/training-types";
import { localDateDaysEarlier } from "../app/domain/training-insights";
import { strengthRecords } from "../app/domain/training-metrics";
import { buildCoachPrompt } from "../app/interchange/coach-export";
import { portableBackup } from "../app/persistence/portable-backup";
import { validateSyncedState } from "../app/persistence/training-validation";
import { AI_SYSTEM_BRIEF_OPTIONS, buildAiSystemPrompt, summarizeAiContext } from "../app/ai/coach-context";

const today = localDate();

const strengthWorkout = (date: string, exerciseName: string): WorkoutSession => {
  const workout = makeWorkout("lb", 120, "Strength session");
  workout.status = "completed";
  workout.date = date;
  workout.completedAt = `${date}T18:00:00.000Z`;
  const exercise = makeExercise("lb", 120, exerciseName);
  exercise.sets = [
    makeSet("lb", {
      completed: true,
      loadType: "weighted",
      weightMode: "total",
      plannedReps: "5",
      actualReps: "5",
      plannedWeight: 200,
      actualWeight: 200,
    }),
  ];
  workout.exercises = [exercise];
  workout.blockOrder = [{ type: "exercise", id: exercise.id }];
  return workout;
};

/** Coach profile + 3 goals + 4 completed workouts inside the last 14 days. */
const aiFixture = () => {
  const state = defaultState();
  state.coachProfile = "I train in the morning and prefer short sessions.";
  state.goals = ["Squat 2x bodyweight", "Run 5K under 25 minutes", "Train 3x per week"];
  state.workouts = ["Barbell Bench Press", "Back Squat", "Deadlift", "Overhead Press"].map((name, index) =>
    strengthWorkout(localDateDaysEarlier([0, 3, 7, 10][index], today), name),
  );
  return state;
};

test("system prompt carries the same extract as the brief dialog's buildCoachPrompt", () => {
  const state = aiFixture();
  const prompt = buildAiSystemPrompt(state, today);
  const brief = buildCoachPrompt(state, AI_SYSTEM_BRIEF_OPTIONS, today);
  assert.ok(prompt.includes(brief), "prompt must contain the full brief extract");
  assert.match(prompt, /TRAINING — LAST 7 DAYS/);
  assert.match(prompt, /never invent workouts/);
});

test("system prompt includes the coaching profile and ranked goals", () => {
  const prompt = buildAiSystemPrompt(aiFixture(), today);
  assert.ok(prompt.includes("I train in the morning and prefer short sessions."));
  assert.match(prompt, /GOALS — RANKED IN PRIORITY ORDER/);
  assert.ok(prompt.includes("1. Squat 2x bodyweight"));
  assert.ok(prompt.includes("3. Train 3x per week"));
});

test("one-liner summarizes real counts from state", () => {
  const state = aiFixture();
  const records = strengthRecords(state, state.settings.defaultUnit).size;
  assert.ok(records >= 4, "fixture should produce several strength records");
  const summary = summarizeAiContext(state, today);
  assert.equal(
    summary.oneLiner,
    `Includes: coaching profile, 3 goals, last 14 days (4 completed workouts), ${records} strength records.`,
  );
  assert.equal(summary.charCount, buildAiSystemPrompt(state, today).length);
  assert.ok(summary.charCount > 0);
});

test("one-liner notes a missing coaching profile", () => {
  const summary = summarizeAiContext(defaultState(), today);
  assert.match(summary.oneLiner, /^Includes: no coaching profile, 0 goals, last 14 days \(0 completed workouts\), 0 strength records\.$/);
});

test("portable backup strips the AI API key and validates without it", () => {
  const state = aiFixture();
  state.settings.aiProvider = "openrouter";
  state.settings.aiApiKey = "sk-secret-on-device";
  state.settings.aiModel = "some-model";
  const backup = portableBackup(state, state);
  assert.equal(backup.settings.aiApiKey, undefined);
  assert.equal(backup.settings.aiProvider, "openrouter");
  assert.equal(backup.settings.aiModel, "some-model");
  assert.ok(!JSON.stringify(backup).includes("sk-secret-on-device"));
  const validated = validateSyncedState(backup);
  assert.equal(validated.settings.aiApiKey, undefined);
});
