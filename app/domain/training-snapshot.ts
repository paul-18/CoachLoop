import { dateInWindow } from "./training-insights";
import { parseExactReps, performedReps } from "./training-metrics";
import { localDate, type TrainingState } from "./training-types";

/** A log summary, not a readiness or fatigue score. Missing effort remains unknown. */
export function weeklyTrainingSignals(state: TrainingState, today = localDate()) {
  const workouts = state.workouts.filter((item) => item.status === "completed" && dateInWindow(item.date, 7, today));
  const hard = (value: string) => Number(value) >= 7 && Number(value) <= 10;
  const hardActivity = (value: string) => /\b(hard|threshold|intervals?|tempo|sprint|max(?:imal)?)\b/i.test(value);
  const hardEnduranceDates = workouts.filter((item) => item.cardio.some((entry) => entry.completed && ["run", "ruck"].includes(entry.activityType) && (hard(entry.effort) || hardActivity(entry.intensity)))).map((item) => item.date);
  const lowerLiftingDates = workouts.filter((item) => item.exercises.some((exercise) => /\b(squat|deadlift|leg press|lunge|split squat|romanian|rdl)\b/i.test(exercise.name) && exercise.sets.some((set) => set.completed && !set.warmup && parseExactReps(performedReps(set)) !== null))).map((item) => item.date);
  const day = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86400000;
  return {
    loggedSessions: workouts.length,
    overlap: hardEnduranceDates.some((runDate) => lowerLiftingDates.some((liftDate) => Math.abs(day(runDate) - day(liftDate)) <= 1)),
  };
}
