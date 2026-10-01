import { localDate, type TrainingState } from "./training-types";

const WEEKLY_DAYS = 5;

function monday(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

function priorWeek(start: string) {
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** Completed calendar days, not sessions; a planned rest day does not break a streak. */
export function trainingWeekStreak(state: TrainingState, today = localDate()) {
  const weeks = new Map<string, Set<string>>();
  for (const workout of state.workouts) {
    if (workout.status !== "completed" || workout.date > today || !/^\d{4}-\d{2}-\d{2}$/.test(workout.date)) continue;
    const key = monday(workout.date);
    if (!weeks.has(key)) weeks.set(key, new Set());
    weeks.get(key)!.add(workout.date);
  }
  const currentWeek = monday(today);
  const daysThisWeek = weeks.get(currentWeek)?.size ?? 0;
  let cursor = daysThisWeek >= WEEKLY_DAYS ? currentWeek : priorWeek(currentWeek);
  let count = 0;
  while ((weeks.get(cursor)?.size ?? 0) >= WEEKLY_DAYS && count < 520) {
    count += 1;
    cursor = priorWeek(cursor);
  }
  return { weeks: count, daysThisWeek, targetDays: WEEKLY_DAYS };
}
