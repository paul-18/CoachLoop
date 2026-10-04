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

/** Validation for actual evidence, not editable prescription ranges. Legacy
 * records remain readable; an invalid new edit becomes an incomplete draft. */
export function setEvidenceError(set: TrainingSet): string | null {
  if (!/^[1-9]\d*$/.test(set.actualReps.trim())) return "Enter actual reps as a positive whole number";
  if (set.rpe.trim() && set.rir.trim()) return "Use either RPE or RIR, not both";
  const effort = (text: string, min: number, max: number) => !text.trim() || (/^\d+(?:\.\d+)?$/.test(text.trim()) && Number(text) >= min && Number(text) <= max);
  if (!effort(set.rpe, 1, 10)) return "Actual RPE must be a number from 1 to 10";
  if (!effort(set.rir, 0, 10)) return "Actual RIR must be a number from 0 to 10";
  return null;
}

export function editedSet(set: TrainingSet, changes: Partial<TrainingSet>, updatedAt: string): TrainingSet {
  const changesActual = ["actualWeight", "actualReps", "rpe", "rir"].some(key => key in changes);
  const next = { ...set, ...changes, updatedAt, completedAsPlanned: "completedAsPlanned" in changes ? Boolean(changes.completedAsPlanned) : changesActual ? false : set.completedAsPlanned };
  // Clearing/typing an actual is allowed, but cannot remain credited as done.
  if (changesActual && next.completed && setEvidenceError(next)) {
    next.completed = false; next.completedAsPlanned = false;
  }
  return next;
}

export const hasWorkingStrength = (workout: WorkoutSession) => workout.exercises.some(e => e.sets.some(s => s.completed && !s.skipped && !s.warmup && parseExactReps(s.actualReps) !== null));
export const hasTrainingActivity = (workout: WorkoutSession) => workout.cardio.some(hasCompletedActivityWork) || !!workout.hyrox?.segments.some(s => s.splitMs !== null);
export const hasTrainingEvidence = (workout: WorkoutSession) => hasWorkingStrength(workout) || hasTrainingActivity(workout);

export const performedReps = (set: TrainingSet) =>
  set.actualReps;

export const performedWeight = (set: TrainingSet) =>
  set.actualWeight;

// Placeholders show the plan but are not input values. Commit any visible planned
// reps/load when the user checks the set, including when they only edited RPE.
export const completedSetValues = (set: TrainingSet) => {
  const enteredReps = set.actualReps.trim();
  if (enteredReps && !/^[1-9]\d*$/.test(enteredReps)) throw new Error("Enter the reps you performed as a positive whole number");
  if (!enteredReps && !/^[1-9]\d*$/.test(set.plannedReps.trim())) throw new Error("Enter the reps you performed for this target");
  if (/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(set.plannedReps.trim()) && !/^[1-9]\d*$/.test(enteredReps)) {
    throw new Error(`Enter the reps you performed for the ${set.plannedReps} rep target.`);
  }
  const actualReps = enteredReps ? set.actualReps : set.plannedReps;
  const error = setEvidenceError({ ...set, actualReps });
  if (error) throw new Error(error);
  return {
    completedAsPlanned: !enteredReps && set.actualWeight === null && !set.rpe.trim() && !set.rir.trim(),
    actualReps,
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
