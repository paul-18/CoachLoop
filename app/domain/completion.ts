import type { CardioEntry, TrainingSet, WorkoutSession } from "./training-types";
export const hasCompletedActivityWork = (activity: CardioEntry) => activity.completed || !!activity.efforts?.some((e) => e.completed);
export const performedDuration = (activity: CardioEntry) =>
  activity.efforts?.length ? activity.efforts.filter((e) => e.completed).reduce<number | null>((sum, e) => e.actualDurationSec === null ? sum : (sum ?? 0) + e.actualDurationSec / 60, null) : activity.actualDurationMin;
export const performedDistance = (activity: CardioEntry) =>
  activity.efforts?.length ? activity.efforts.filter((e) => e.completed).reduce<number | null>((sum, e) => e.actualDistanceM === null ? sum : (sum ?? 0) + e.actualDistanceM / 1000, null) : activity.actualDistanceKm;

/** Accept each displayed prescription independently when completing a partly edited activity. */
export const completedActivityValues = (activity: CardioEntry) => ({
  completedAsPlanned: activity.actualDurationMin === null && activity.actualDistanceKm === null,
  actualDurationMin: activity.actualDurationMin ?? activity.plannedDurationMin,
  actualDistanceKm: activity.actualDistanceKm ?? activity.plannedDistanceKm,
});

export const parseExactReps = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const performedReps = (set: TrainingSet) =>
  set.actualReps;

export const performedWeight = (set: TrainingSet) =>
  set.actualWeight;

// Placeholders show the plan but are not input values. Commit any visible planned
// reps/load when the user checks the set, including when they only edited RPE.
export const completedSetValues = (set: TrainingSet) => {
  const enteredReps = set.actualReps.trim();
  if (/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(set.plannedReps.trim()) && !/^[1-9]\d*$/.test(enteredReps)) {
    throw new Error(`Enter the reps you performed for the ${set.plannedReps} rep target.`);
  }
  return {
    completedAsPlanned: !enteredReps && set.actualWeight === null && !set.rpe.trim() && !set.rir.trim(),
    actualReps: enteredReps ? set.actualReps : set.plannedReps,
    actualWeight: set.actualWeight ?? set.plannedWeight,
  };
};


/** Keep completed efforts visible even when their parent activity is unfinished. */
export function workoutCompletionSummary(workout: WorkoutSession): string {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const doneSets = sets.filter((set) => set.completed).length;
  const efforts = workout.cardio.flatMap((activity) => activity.efforts ?? []);
  const doneEfforts = efforts.filter((effort) => effort.completed).length;
  const singles = workout.cardio.filter((activity) => !activity.efforts?.length);
  const doneSingles = singles.filter((activity) => activity.completed).length;
  if (!doneSets && !doneEfforts && !doneSingles) return "Nothing is marked complete yet, but you can still save the session.";
  return [sets.length ? `${doneSets}/${sets.length} sets` : "", efforts.length ? `${doneEfforts}/${efforts.length} efforts` : "", singles.length ? `${doneSingles}/${singles.length} activities` : ""].filter(Boolean).join(" · ") + " complete.";
}
