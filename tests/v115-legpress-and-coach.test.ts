import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeWorkout } from "../app/domain/training-types";
import { buildQuickTrainingExtract } from "../app/interchange/coach-export";
import { APP_RELEASE } from "../app/app-release";

test("v117: APP_RELEASE is v117", () => {
  assert.equal(APP_RELEASE, "v117");
});

test("v115: buildQuickTrainingExtract supports 2, 7, 14, 30, and 60 days", () => {
  const state = defaultState();
  const workoutToday = makeWorkout("lb", 60, "Today Leg Day");
  workoutToday.date = "2026-11-01";
  workoutToday.status = "completed";
  workoutToday.completedAt = "2026-11-01T10:00:00Z";

  const workoutYesterday = makeWorkout("lb", 60, "Yesterday Upper");
  workoutYesterday.date = "2026-10-31";
  workoutYesterday.status = "completed";
  workoutYesterday.completedAt = "2026-10-31T10:00:00Z";

  const workout10DaysAgo = makeWorkout("lb", 60, "Ten Days Ago Run");
  workout10DaysAgo.date = "2026-10-22";
  workout10DaysAgo.status = "completed";
  workout10DaysAgo.completedAt = "2026-10-22T10:00:00Z";

  const workout45DaysAgo = makeWorkout("lb", 60, "Month Ago Lift");
  workout45DaysAgo.date = "2026-09-17";
  workout45DaysAgo.status = "completed";
  workout45DaysAgo.completedAt = "2026-09-17T10:00:00Z";

  state.workouts = [workoutToday, workoutYesterday, workout10DaysAgo, workout45DaysAgo];

  // Today
  const todayExtract = buildQuickTrainingExtract(state, "today", "2026-11-01");
  assert.ok(todayExtract.includes("Today Leg Day"));
  assert.equal(todayExtract.includes("Yesterday Upper"), false);

  // Two days (today and yesterday)
  const twoDaysExtract = buildQuickTrainingExtract(state, "two-days", "2026-11-01");
  assert.ok(twoDaysExtract.includes("Today Leg Day"));
  assert.ok(twoDaysExtract.includes("Yesterday Upper"));
  assert.equal(twoDaysExtract.includes("Ten Days Ago Run"), false);

  // Seven days
  const sevenDaysExtract = buildQuickTrainingExtract(state, "seven-days", "2026-11-01");
  assert.ok(sevenDaysExtract.includes("Today Leg Day"));
  assert.ok(sevenDaysExtract.includes("Yesterday Upper"));
  assert.equal(sevenDaysExtract.includes("Ten Days Ago Run"), false);

  // Fourteen days
  const fourteenDaysExtract = buildQuickTrainingExtract(state, "fourteen-days", "2026-11-01");
  assert.ok(fourteenDaysExtract.includes("Today Leg Day"));
  assert.ok(fourteenDaysExtract.includes("Yesterday Upper"));
  assert.ok(fourteenDaysExtract.includes("Ten Days Ago Run"));
  assert.equal(fourteenDaysExtract.includes("Month Ago Lift"), false);

  // Thirty days
  const thirtyDaysExtract = buildQuickTrainingExtract(state, "thirty-days", "2026-11-01");
  assert.ok(thirtyDaysExtract.includes("Ten Days Ago Run"));
  assert.equal(thirtyDaysExtract.includes("Month Ago Lift"), false);

  // Sixty days
  const sixtyDaysExtract = buildQuickTrainingExtract(state, "sixty-days", "2026-11-01");
  assert.ok(sixtyDaysExtract.includes("Month Ago Lift"));
  assert.ok(sixtyDaysExtract.includes("Today Leg Day"));
});
