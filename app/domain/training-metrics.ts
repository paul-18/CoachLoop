import { localDate, type TrainingSet, type TrainingState, type WorkoutSession, type Unit, type WeightMode } from "./training-types";

export { canonicalExerciseName, exerciseIdentity } from "./exercise-identity";
import { canonicalExerciseName } from "./exercise-identity";
export { performedDuration, performedDistance, completedActivityValues, parseExactReps, performedReps, performedWeight, completedSetValues } from "./completion";
import { parseExactReps, performedReps, performedWeight } from "./completion";
export const weightModeLabel = (mode: WeightMode) =>
  mode === "per_hand" ? "each" : mode === "added" ? "added" : "total";

export const formatLoad = (
  loadType: TrainingSet["loadType"],
  weight: number | null,
  unit: Unit,
  mode: WeightMode,
) => {
  if (loadType === "bodyweight") return "Bodyweight";
  if (loadType === "unrecorded" || weight === null) return "Load not recorded";
  const suffix = mode === "per_hand" ? " each" : mode === "added" ? " added" : " total";
  return `${weight} ${unit}${suffix}`;
};

export const formatPerformedSet = (set: TrainingSet) => {
  const reps = performedReps(set);
  const load = formatLoad(set.loadType, performedWeight(set), set.unit, set.weightMode);
  const effort = set.rpe ? ` @ RPE ${set.rpe}` : set.rir ? ` @ RIR ${set.rir}` : "";
  const result = `${load} × ${reps || "reps not recorded"}${effort}${set.warmup ? " (warm-up)" : ""}`;
  return set.completedAsPlanned ? `completed as prescribed (${result})` : result;
};

export const convertWeight = (weight: number, from: Unit, to: Unit) => {
  if (from === to) return weight;
  return to === "lb" ? weight * 2.2046226218 : weight / 2.2046226218;
};

/**
 * e1RM is only useful for low-rep, barbell-style strength work.  It is deliberately
 * not used for high-rep accessories or bodyweight conditioning.
 */
export const estimatedOneRepMax = (weight: number, reps: number) =>
  reps > 0 && reps <= 10 ? reps === 1 ? weight : weight * (1 + reps / 30) : null;

export const isPrimaryStrengthExercise = (name: string) => {
  const value = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (/dumbbell|\bdb\b|machine|smith|kettlebell|cable|pull.?up|chin.?up|dip/.test(value)) return false;
  return /bench press|(?:back|front|barbell) squat|deadlift|overhead press|military press/.test(value);
};

export type StrengthRecord = {
  weight: number;
  unit: Unit;
  reps: number;
  e1rm: number;
  display: string;
};

export const strengthRecords = (state: TrainingState, targetUnit: Unit, sinceDate?: string) => {
  const records = new Map<string, StrengthRecord>();
  state.workouts
    .filter((workout) => workout.status === "completed" && workout.date <= localDate() && (!sinceDate || workout.date >= sinceDate))
    .forEach((workout) => workout.exercises.forEach((exercise) => exercise.sets.forEach((set) => {
      const name = canonicalExerciseName(exercise.name, state.exerciseAliases);
      if (!isPrimaryStrengthExercise(name) || !set.completed || set.warmup || set.loadType !== "weighted" || set.weightMode !== "total") return;
      const reps = parseExactReps(performedReps(set));
      const weight = performedWeight(set);
      if (reps === null || weight === null || weight <= 0) return;
      const normalizedWeight = convertWeight(weight, set.unit, targetUnit);
      const e1rm = estimatedOneRepMax(normalizedWeight, reps);
      if (e1rm === null) return;
      const current = records.get(name);
      if (!current || e1rm > current.e1rm) {
        records.set(name, {
          weight,
          unit: set.unit,
          reps,
          e1rm,
          display: `${weight} ${set.unit} ${weightModeLabel(set.weightMode)} × ${reps}`,
        });
      }
    })));
  return records;
};


/** External-load volume; never infer reps from ranges or body mass. */
export const workoutLiftingVolume = (workout: WorkoutSession, unit: Unit) => {
  let volume = 0;
  let countedSets = 0;
  let excludedSets = 0;
  for (const exercise of workout.exercises) for (const set of exercise.sets) {
    if (!set.completed || set.warmup) continue;
    const reps = parseExactReps(performedReps(set));
    const weight = performedWeight(set);
    if (set.loadType !== "weighted" || weight === null || !Number.isFinite(weight) || weight <= 0 || reps === null) {
      excludedSets++;
      continue;
    }
    volume += convertWeight(weight, set.unit, unit) * reps * (set.weightMode === "per_hand" ? 2 : 1);
    countedSets++;
  }
  return { volume, countedSets, excludedSets };
};
