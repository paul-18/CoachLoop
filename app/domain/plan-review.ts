import { formatLoad, performedDistance, performedDuration, performedReps, performedWeight, formatMeasure } from "./training-metrics";
import { setDisplayNumbers } from "./completion";
import { segmentMeasure } from "./activity-segments";
import { localDate, type WorkoutSession } from "./training-types";
import { validMeasurementDate } from "./training-workflow";

export function reschedulePlannedWorkout(workout: WorkoutSession, date: string, updatedAt: string): WorkoutSession {
  if (workout.status !== "planned" || !validMeasurementDate(date)) throw new Error("Choose a valid date for a saved plan.");
  return { ...workout, date, updatedAt };
}

/** Correct the calendar date without rewriting when work was actually saved. */
export function changeWorkoutDate(workout: WorkoutSession, date: string, today = localDate()): WorkoutSession {
  if (!validMeasurementDate(date) || (workout.status !== "planned" && date > today)) throw new Error("Choose a valid workout date up to today.");
  return { ...workout, date, updatedAt: new Date().toISOString() };
}

/** Only compare completed work that had an actual prescription. Unfinished work has its own review. */
export function planDifferences(workout: WorkoutSession): string[] {
  const changes: string[] = [];
  for (const exercise of workout.exercises) {
    const numbers = setDisplayNumbers(exercise.sets);
    const warmupCount = exercise.sets.filter((s) => s.warmup).length;
    exercise.sets.forEach((set, index) => {
      if (!set.completed || (!set.plannedReps.trim() && set.plannedWeight === null)) return;
      const actualReps = performedReps(set);
      const actualWeight = performedWeight(set);
      const repsChanged = Boolean(set.plannedReps.trim()) && actualReps.trim() !== set.plannedReps.trim();
      const weightChanged = set.plannedWeight !== null && (actualWeight === null || Math.abs(actualWeight - set.plannedWeight) > 0.0001);
      if (!repsChanged && !weightChanged) return;
      const format = (weight: number | null, reps: string) => `${formatLoad(set.loadType, weight, set.unit, set.weightMode).replace(/ total$/, "")} × ${reps || "—"}`;
      const setLabel = set.warmup
        ? (warmupCount > 1 ? `Warm-up ${numbers[index]?.short.replace(/^W/, "")}` : "Warm-up")
        : (numbers[index]?.label ?? `Set ${index + 1}`);
      changes.push(`${exercise.name} · ${setLabel}: ${format(set.plannedWeight, set.plannedReps)} → ${format(actualWeight, actualReps)}`);
    });
  }
  for (const activity of workout.cardio) {
    if (!activity.completed || activity.skipped) continue;
    const planned: string[] = [];
    const actual: string[] = [];
    const segmentPlannedDurationMin = activity.segments?.length ? (() => { const total = activity.segments.reduce((sum, segment) => sum + (segment.plannedDurationSec ?? 0), 0); return total > 0 ? total / 60 : null; })() : null;
    const segmentPlannedDistanceKm = activity.segments?.length ? (() => { const total = activity.segments.reduce((sum, segment) => sum + (segment.plannedDistanceM ?? 0), 0); return total > 0 ? total / 1000 : null; })() : null;
    const plannedDurationMin = activity.plannedDurationMin ?? segmentPlannedDurationMin;
    const plannedDistanceKm = activity.plannedDistanceKm ?? segmentPlannedDistanceKm;
    const durationIncomplete = activity.segments?.length ? (() => { const measure = segmentMeasure(activity, "duration"); return measure !== null && measure.done > 0 && !measure.fullyRecorded; })() : false;
    const distanceIncomplete = activity.segments?.length ? (() => { const measure = segmentMeasure(activity, "distance"); return measure !== null && measure.done > 0 && !measure.fullyRecorded; })() : false;
    if (plannedDurationMin !== null && performedDuration(activity) !== plannedDurationMin) {
      planned.push(`${formatMeasure(plannedDurationMin)} min`);
      actual.push(performedDuration(activity) === null ? (durationIncomplete ? "Not fully recorded" : "— min") : `${formatMeasure(performedDuration(activity)!)} min`);
    }
    if (plannedDistanceKm !== null && (performedDistance(activity) === null || Math.abs(performedDistance(activity)! - plannedDistanceKm) > 0.0001)) {
      planned.push(`${formatMeasure(plannedDistanceKm)} km`);
      actual.push(performedDistance(activity) === null ? (distanceIncomplete ? "Not fully recorded" : "— km") : `${formatMeasure(performedDistance(activity)!)} km`);
    }
    if (planned.length) changes.push(`${activity.name}: ${planned.join(" · ")} → ${actual.join(" · ")}`);
  }
  return changes;
}
