import { canonicalExerciseName, exerciseIdentity } from "./exercise-identity";
import { convertWeight, estimatedOneRepMax, formatLoad, isPrimaryStrengthExercise, parseExactReps, performedReps, performedWeight } from "./training-metrics";
import type { LoadType, TrainingState, WeightMode, WorkoutSession } from "./training-types";

export type PersonalRecordKind = "Load PR" | "e1RM PR" | "Rep PR";

export interface SetPersonalRecord {
  setId: string;
  exerciseId: string;
  exerciseName: string;
  kind: PersonalRecordKind;
  label: "PR";
  summary: string;
}

interface BaselineBucket {
  hasPrior: boolean;
  bestWeight: number;
  bestE1rm: number;
  bestReps: number;
  sets: Array<{ weight: number; reps: number }>;
}

const isPriorWorkout = (candidate: WorkoutSession, target: WorkoutSession): boolean => {
  if (candidate.status !== "completed" || candidate.id === target.id) return false;
  if (candidate.date !== target.date) return candidate.date < target.date;
  if (target.status !== "completed") return true;
  const candidateTime = candidate.completedAt ?? candidate.createdAt;
  const targetTime = target.completedAt ?? target.createdAt;
  return candidateTime < targetTime;
};

const bucketKey = (identity: string, loadType: LoadType, weightMode: WeightMode) =>
  `${identity}|${loadType}|${weightMode}`;

/**
 * Computes set-level personal records for a workout against all prior completed sessions.
 * Requires at least one prior completed working set for the same exercise and load mode
 * so brand-new exercises do not mark their initial baseline sets as PRs.
 */
export function workoutPersonalRecords(
  state: TrainingState,
  workout: WorkoutSession,
): Map<string, SetPersonalRecord> {
  const result = new Map<string, SetPersonalRecord>();
  const targetUnit = state.settings.defaultUnit;
  const buckets = new Map<string, BaselineBucket>();

  const getBucket = (key: string): BaselineBucket => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { hasPrior: false, bestWeight: 0, bestE1rm: 0, bestReps: 0, sets: [] };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const prior of state.workouts) {
    if (!isPriorWorkout(prior, workout)) continue;
    for (const exercise of prior.exercises) {
      const identity = exerciseIdentity(exercise.name, state.exerciseAliases);
      const canonical = canonicalExerciseName(exercise.name, state.exerciseAliases);
      const primary = isPrimaryStrengthExercise(canonical);
      for (const set of exercise.sets) {
        if (!set.completed || set.skipped || set.warmup) continue;
        const reps = parseExactReps(performedReps(set));
        if (reps === null) continue;
        if (set.loadType === "bodyweight") {
          const bucket = getBucket(bucketKey(identity, "bodyweight", set.weightMode));
          bucket.hasPrior = true;
          if (reps > bucket.bestReps) bucket.bestReps = reps;
        } else if (set.loadType === "weighted") {
          const weight = performedWeight(set);
          if (weight === null || !Number.isFinite(weight) || weight <= 0) continue;
          const normWeight = Number(convertWeight(weight, set.unit, targetUnit).toFixed(4));
          const bucket = getBucket(bucketKey(identity, "weighted", set.weightMode));
          bucket.hasPrior = true;
          if (normWeight > bucket.bestWeight) bucket.bestWeight = normWeight;
          if (primary && set.weightMode === "total") {
            const e1rm = estimatedOneRepMax(normWeight, reps);
            if (e1rm !== null && e1rm > bucket.bestE1rm) bucket.bestE1rm = e1rm;
          }
          bucket.sets.push({ weight: normWeight, reps });
        }
      }
    }
  }

  for (const exercise of workout.exercises) {
    const identity = exerciseIdentity(exercise.name, state.exerciseAliases);
    const canonical = canonicalExerciseName(exercise.name, state.exerciseAliases);
    const primary = isPrimaryStrengthExercise(canonical);
    for (const set of exercise.sets) {
      if (!set.completed || set.skipped || set.warmup) continue;
      const reps = parseExactReps(performedReps(set));
      if (reps === null) continue;
      if (set.loadType === "bodyweight") {
        const bucket = buckets.get(bucketKey(identity, "bodyweight", set.weightMode));
        if (!bucket?.hasPrior) continue;
        if (reps > bucket.bestReps) {
          bucket.bestReps = reps;
          result.set(set.id, {
            setId: set.id,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            kind: "Rep PR",
            label: "PR",
            summary: `${exercise.name}: Bodyweight × ${reps} (Rep PR)`,
          });
        }
      } else if (set.loadType === "weighted") {
        const weight = performedWeight(set);
        if (weight === null || !Number.isFinite(weight) || weight <= 0) continue;
        const bucket = buckets.get(bucketKey(identity, "weighted", set.weightMode));
        if (!bucket?.hasPrior) continue;
        const normWeight = Number(convertWeight(weight, set.unit, targetUnit).toFixed(4));
        const e1rm = primary && set.weightMode === "total" ? estimatedOneRepMax(normWeight, reps) : null;
        const maxRepsAtOrAbove = bucket.sets
          .filter((item) => item.weight >= normWeight - 1e-6)
          .reduce((max, item) => Math.max(max, item.reps), 0);

        let kind: PersonalRecordKind | null = null;
        if (normWeight > bucket.bestWeight + 1e-6) {
          kind = "Load PR";
        } else if (e1rm !== null && bucket.bestE1rm > 0 && e1rm > bucket.bestE1rm + 1e-6) {
          kind = "e1RM PR";
        } else if (maxRepsAtOrAbove > 0 && reps > maxRepsAtOrAbove) {
          kind = "Rep PR";
        }

        if (normWeight > bucket.bestWeight) bucket.bestWeight = normWeight;
        if (e1rm !== null && e1rm > bucket.bestE1rm) bucket.bestE1rm = e1rm;
        bucket.sets.push({ weight: normWeight, reps });

        if (kind) {
          result.set(set.id, {
            setId: set.id,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            kind,
            label: "PR",
            summary: `${exercise.name}: ${formatLoad(set.loadType, weight, set.unit, set.weightMode)} × ${reps} (${kind})`,
          });
        }
      }
    }
  }

  return result;
}
