import { formatLoad, performedDistance, performedDuration, performedReps, performedWeight } from "./training-metrics";
import type { WorkoutSession } from "./training-types";
import { validMeasurementDate } from "./training-workflow";

export function reschedulePlannedWorkout(workout: WorkoutSession, date: string, updatedAt: string): WorkoutSession {
  if (workout.status !== "planned" || !validMeasurementDate(date)) throw new Error("Choose a valid date for a saved plan.");
  return { ...workout, date, updatedAt };
}

/** Only compare completed work that had an actual prescription. Unfinished work has its own review. */
export function planDifferences(workout: WorkoutSession): string[] {
  const changes: string[] = [];
  for (const exercise of workout.exercises) {
    exercise.sets.forEach((set, index) => {
      if (!set.completed || (!set.plannedReps.trim() && set.plannedWeight === null)) return;
      const actualReps = performedReps(set);
      const actualWeight = performedWeight(set);
      const repsChanged = Boolean(set.plannedReps.trim()) && actualReps.trim() !== set.plannedReps.trim();
      const weightChanged = set.plannedWeight !== null && (actualWeight === null || Math.abs(actualWeight - set.plannedWeight) > 0.0001);
      if (!repsChanged && !weightChanged) return;
      const format = (weight: number | null, reps: string) => `${formatLoad(set.loadType, weight, set.unit, set.weightMode).replace(/ total$/, "")} × ${reps || "—"}`;
      changes.push(`${exercise.name} · ${set.warmup ? "Warm-up" : `Set ${index + 1}`}: ${format(set.plannedWeight, set.plannedReps)} → ${format(actualWeight, actualReps)}`);
    });
  }
  for (const activity of workout.cardio) {
    if (!activity.completed) continue;
    const planned: string[] = [];
    const actual: string[] = [];
    if (activity.plannedDurationMin !== null && performedDuration(activity) !== activity.plannedDurationMin) {
      planned.push(`${activity.plannedDurationMin} min`);
      actual.push(performedDuration(activity) === null ? "— min" : `${performedDuration(activity)} min`);
    }
    if (activity.plannedDistanceKm !== null && (performedDistance(activity) === null || Math.abs(performedDistance(activity)! - activity.plannedDistanceKm) > 0.0001)) {
      planned.push(`${activity.plannedDistanceKm} km`);
      actual.push(performedDistance(activity) === null ? "— km" : `${performedDistance(activity)} km`);
    }
    if (planned.length) changes.push(`${activity.name}: ${planned.join(" · ")} → ${actual.join(" · ")}`);
  }
  return changes;
}
