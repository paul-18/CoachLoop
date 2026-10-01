import type { CardioEntry, TrainingSet } from "./training-types";
export const performedDuration = (activity: CardioEntry) =>
  activity.actualDurationMin;
export const performedDistance = (activity: CardioEntry) =>
  activity.actualDistanceKm;

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
  return {
    completedAsPlanned: !enteredReps && set.actualWeight === null && !set.rpe.trim() && !set.rir.trim(),
    actualReps: enteredReps ? set.actualReps : set.plannedReps,
    actualWeight: set.actualWeight ?? set.plannedWeight,
  };
};

