import test from "node:test";
import assert from "node:assert/strict";
import { trainingWeekStreak } from "../app/domain/training-streak";
import { defaultState, makeWorkout } from "../app/domain/training-types";

test("weekly streak counts distinct completed training days and allows rest days", () => {
  const state = defaultState();
  state.workouts = [
    ["2026-09-21", "completed"], ["2026-09-22", "completed"],
    ["2026-09-22", "completed"], ["2026-09-23", "completed"],
    ["2026-09-24", "completed"], ["2026-09-25", "completed"],
    ["2026-09-28", "completed"], ["2026-09-29", "completed"],
    ["2026-09-30", "skipped"],
  ].map(([date, status]) => ({ ...makeWorkout("lb", 90), date, status: status as "completed" | "skipped" }));
  assert.deepEqual(trainingWeekStreak(state, "2026-09-29"), { weeks: 1, daysThisWeek: 2, targetDays: 5 });
  for (const date of ["2026-09-30", "2026-10-01", "2026-10-02"]) state.workouts.push({ ...makeWorkout("lb", 90), date, status: "completed" });
  assert.deepEqual(trainingWeekStreak(state, "2026-10-02"), { weeks: 2, daysThisWeek: 5, targetDays: 5 });
  assert.deepEqual(trainingWeekStreak(state, "2026-10-05"), { weeks: 2, daysThisWeek: 0, targetDays: 5 });
});
