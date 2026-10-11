import type { ActivityEffort, CardioEntry, TrainingSet, WorkoutSession } from "./training-types";
import { normalizedBlockOrder } from "./block-order";
export const hasCompletedActivityWork = (activity: CardioEntry) => activity.completed || !!activity.efforts?.some((e) => e.completed);
export const performedDuration = (activity: CardioEntry) =>
  activity.efforts?.length ? activity.efforts.filter((e) => e.completed).reduce<number | null>((sum, e) => e.actualDurationSec === null ? sum : (sum ?? 0) + e.actualDurationSec / 60, null) : activity.actualDurationMin;
export const performedDistance = (activity: CardioEntry) =>
  activity.efforts?.length ? activity.efforts.filter((e) => e.completed).reduce<number | null>((sum, e) => e.actualDistanceM === null ? sum : (sum ?? 0) + e.actualDistanceM / 1000, null) : activity.actualDistanceKm;

/** Print a measured total. Does not change stored metres, seconds or sums. */
export function formatMeasure(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toFixed(maxDecimals)));
}

/** Kilometres shown in km, or metres, without a binary tail such as 1004.9999999999999. */
export function displayedDistance(kilometres: number, unit: "m" | "km" = "km"): number {
  if (!Number.isFinite(kilometres)) return kilometres;
  const shown = unit === "m" ? kilometres * 1000 : kilometres;
  return Number(shown.toFixed(2));
}

/** Same rounding as formatMeasure, for a copied plan target rather than a display string. */
export function roundedMeasure(value: number | null, maxDecimals = 2): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  return Number(value.toFixed(maxDecimals));
}

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


export const activityStillOpen = (activity: CardioEntry) => {
  if (activity.skipped) return false;
  if (activity.efforts?.length) return activity.efforts.some(effort => !effort.completed);
  return !activity.completed;
};

export function nextOpenBlock(workout: WorkoutSession) {
  for (const block of normalizedBlockOrder(workout)) {
    if (block.type === "exercise") {
      const exercise = workout.exercises.find(item => item.id === block.id);
      if (exercise?.sets.some(set => !set.completed && !set.skipped)) return { type: "exercise" as const, exercise };
    } else {
      const activity = workout.cardio.find(item => item.id === block.id);
      if (activity && activityStillOpen(activity)) return { type: "activity" as const, activity };
    }
  }
  return undefined;
}

/** Warm-ups and working sets each start at 1. Stored set order is unchanged. */
export function setDisplayNumbers<T extends { warmup?: boolean }>(sets: readonly T[]) {
  let warmups = 0;
  let working = 0;
  return sets.map((set) => {
    if (set.warmup) {
      warmups += 1;
      return { short: `W${warmups}`, label: `W${warmups}` };
    }
    working += 1;
    return { short: String(working), label: `Set ${working}` };
  });
}

/** The next unfinished set or activity at or after this block. Earlier open work is left behind. */
export function nextRestTarget(workout: WorkoutSession, fromBlockId: string, fromSetId?: string) {
  const order = normalizedBlockOrder(workout);
  const start = order.findIndex((block) => block.id === fromBlockId);
  if (start < 0) return undefined;
  for (let index = start; index < order.length; index += 1) {
    const block = order[index];
    if (block.type === "exercise") {
      const exercise = workout.exercises.find((item) => item.id === block.id);
      if (!exercise) continue;
      let startAt = 0;
      if (index === start && fromSetId) {
        const found = exercise.sets.findIndex((set) => set.id === fromSetId);
        if (found < 0) continue;
        startAt = found + 1;
      }
      const set = exercise.sets.slice(startAt).find((item) => !item.completed && !item.skipped);
      if (set) return { type: "exercise" as const, exercise, set };
    } else {
      const activity = workout.cardio.find((item) => item.id === block.id);
      if (activity && activityStillOpen(activity)) return { type: "activity" as const, activity };
    }
  }
  return undefined;
}

const countableSets = (workout: WorkoutSession) => workout.exercises.flatMap(exercise => exercise.sets).filter(set => !set.skipped || set.completed);
const openActivities = (workout: WorkoutSession) => workout.cardio.filter(activity => !activity.skipped);

/** The same counts for the workout header and the finish dialog. Skipped work is left out. */
export function workoutProgressCopy(workout: WorkoutSession): string {
  const sets = countableSets(workout);
  const doneSets = sets.filter(set => set.completed && !set.skipped).length;
  const activities = openActivities(workout);
  const effortActivities = activities.filter(activity => activity.efforts?.length);
  const singles = activities.filter(activity => !activity.efforts?.length);
  const efforts = effortActivities.flatMap(activity => activity.efforts ?? []);
  const doneEfforts = efforts.filter(effort => effort.completed).length;
  const doneSingles = singles.filter(activity => activity.completed).length;
  const piece = (done: number, total: number, singular: string, plural: string) => total ? `${done}/${total} ${total === 1 ? singular : plural}` : "";
  const parts = [piece(doneSets, sets.length, "set", "sets"), piece(doneEfforts, efforts.length, "effort", "efforts"), piece(doneSingles, singles.length, "activity", "activities")].filter(Boolean);
  return parts.join(" · ");
}

/** Keep completed efforts visible even when their parent activity is unfinished. */
export function workoutCompletionSummary(workout: WorkoutSession): string {
  const progress = workoutProgressCopy(workout);
  const anyDone = progress.split(" · ").some(part => Number(part.split("/")[0]) > 0);
  if (!anyDone) return "Nothing is marked complete yet, but you can still save the session.";
  return `${progress} complete.`;
}

export function hasGenuineTraining(workout: WorkoutSession) {
  const workingSet = workout.exercises.some(exercise => exercise.sets.some(set => set.completed && !set.skipped && !set.warmup));
  const activity = workout.cardio.some(item => !item.skipped && (item.completed || !!item.efforts?.some(effort => effort.completed)));
  return workingSet || activity;
}

/** Same completed-set rule as the workout header: skipped work is left out. */
export function exerciseSetProgress(sets: Array<{ completed: boolean; skipped?: boolean }>) {
  const countable = sets.filter(set => !set.skipped || set.completed);
  const done = countable.filter(set => set.completed && !set.skipped).length;
  return {
    done,
    total: countable.length,
    skippedOnly: sets.length > 0 && sets.every(set => Boolean(set.skipped) && !set.completed),
  };
}

/** History badge. An explicit skip stays Skipped; a missing flag stays unfinished, not skipped. */
export function activityHistoryLabel(activity: CardioEntry): string {
  if (activity.skipped && !activity.completed) return "Skipped";
  if (activity.completed) return activity.completedAsPlanned ? "As prescribed" : "Completed";
  if (hasCompletedActivityWork(activity)) return "Partly completed";
  return "Not completed";
}

const finiteEntered = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value);

export function effortHasTypedActual(effort: ActivityEffort) {
  return finiteEntered(effort.actualDistanceM) || finiteEntered(effort.actualDurationSec) || finiteEntered(effort.actualLoad);
}

/** A typed distance, time, or effort result. Null means untouched. Zero counts as typed. */
export function activityHasTypedActual(activity: CardioEntry) {
  if (activity.efforts?.length) return activity.efforts.some((effort) => !effort.completed && effortHasTypedActual(effort));
  return finiteEntered(activity.actualDistanceKm) || finiteEntered(activity.actualDurationMin);
}

/** Activities the user typed results for but did not mark complete. Skipped and already complete activities are left out. */
export function unconfirmedActualActivities(workout: WorkoutSession) {
  return workout.cardio.filter((activity) => {
    if (activity.skipped) return false;
    if (activity.efforts?.length) return activity.efforts.some((effort) => !effort.completed && effortHasTypedActual(effort));
    if (activity.completed) return false;
    return finiteEntered(activity.actualDistanceKm) || finiteEntered(activity.actualDurationMin);
  });
}

export function unconfirmedActualKey(workout: WorkoutSession) {
  return unconfirmedActualActivities(workout).map((activity) => {
    const efforts = (activity.efforts ?? []).filter((effort) => !effort.completed && effortHasTypedActual(effort))
      .map((effort) => `${effort.id}:${effort.actualDistanceM}:${effort.actualDurationSec}:${effort.actualLoad}`).join(",");
    return `${activity.id}:${activity.actualDistanceKm}:${activity.actualDurationMin}:${efforts}`;
  }).join("|");
}

export function shouldPromptForUnconfirmedActuals(workout: WorkoutSession, acknowledgedKey: string | null) {
  const key = unconfirmedActualKey(workout);
  return key.length > 0 && key !== acknowledgedKey;
}

/** Mark the listed activities complete without copying planned numbers into blank actual fields. */
export function markTypedActivitiesComplete(workout: WorkoutSession, ids: readonly string[]): WorkoutSession {
  const chosen = new Set(ids);
  return {
    ...workout,
    cardio: workout.cardio.map((activity) => {
      if (!chosen.has(activity.id) || activity.skipped) return activity;
      if (activity.efforts?.length) {
        const efforts = activity.efforts.map((effort) => !effort.completed && effortHasTypedActual(effort) ? { ...effort, completed: true } : effort);
        return { ...activity, efforts, completed: efforts.length > 0 && efforts.every((effort) => effort.completed), completedAsPlanned: false };
      }
      return { ...activity, completed: true, completedAsPlanned: false };
    }),
  };
}
