import { canonicalExerciseName } from "./exercise-identity";
import { convertWeight, parseExactReps, performedReps } from "./training-metrics";
import type { CoverageMuscle, ExerciseMuscleTarget, TrainingState, Unit } from "./training-types";
import { dateInWindow } from "./training-insights";

export type MuscleGroup = CoverageMuscle;

export type MuscleCoverage = { muscle: MuscleGroup; effectiveSets: number; days: number };

export const MUSCLE_GROUPS: MuscleGroup[] = ["Chest", "Lats", "Upper back", "Front delts", "Side delts", "Rear delts", "Biceps", "Triceps", "Abs", "Quads", "Hamstrings", "Glutes", "Calves"];
const groups = MUSCLE_GROUPS;

const exerciseKey = (name: string) => name.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export const normalizeExerciseMuscleOverrides = (value: unknown): Record<string, ExerciseMuscleTarget> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([name, raw]) => {
    if (!name.trim() || !raw || typeof raw !== "object") return [];
    const target = raw as Partial<ExerciseMuscleTarget>;
    const primary = Array.isArray(target.primary) ? [...new Set(target.primary.filter((muscle): muscle is MuscleGroup => MUSCLE_GROUPS.includes(muscle as MuscleGroup)))] : [];
    const secondary = Array.isArray(target.secondary) ? [...new Set(target.secondary.filter((muscle): muscle is MuscleGroup => MUSCLE_GROUPS.includes(muscle as MuscleGroup) && !primary.includes(muscle as MuscleGroup)))] : [];
    if (!primary.length && typeof target.deletedAt !== "string") return [];
    return [[exerciseKey(name), { primary, ...(secondary.length ? { secondary } : {}), updatedAt: typeof target.updatedAt === "string" ? target.updatedAt : "1970-01-01T00:00:00.000Z", ...(typeof target.deletedAt === "string" ? { deletedAt: target.deletedAt } : {}) }]];
  }));
};

export const targetForCoverage = (exerciseName: string, overrides: Record<string, ExerciseMuscleTarget> = {}): ExerciseMuscleTarget | null => {
  const custom = overrides[exerciseKey(exerciseName)];
  if (custom?.primary.length && !custom.deletedAt) return custom;
  const name = exerciseName.toLowerCase().replace(/[-_]/g, " ");
  if (/\b(?:bench press|push ?ups?|chest press|chest fly|pec deck)\b/.test(name)) return { primary: ["Chest"], secondary: ["Triceps", "Front delts"] };
  if (/\b(?:weighted )?dips?\b/.test(name)) return { primary: ["Chest", "Triceps"], secondary: ["Front delts"] };
  if (/\b(?:pull ?ups?|chin ?ups?|lat pull(?:down)?)\b/.test(name)) return { primary: ["Lats"], secondary: ["Biceps", "Upper back"] };
  if (/\b(?:rows?|face pull)\b/.test(name)) return { primary: ["Upper back"], secondary: [/\bface pull\b/.test(name) ? "Rear delts" : "Lats", "Biceps"] };
  if (/\blateral raise\b/.test(name)) return { primary: ["Side delts"] };
  if (/\b(?:rear delt|reverse fly)\b/.test(name)) return { primary: ["Rear delts"], secondary: ["Upper back"] };
  if (/\b(?:shoulder press|overhead press|military press)\b/.test(name)) return { primary: ["Front delts"], secondary: ["Triceps", "Side delts"] };
  if (/\b(?:leg curl|hamstring curl|nordic curl)\b/.test(name)) return { primary: ["Hamstrings"] };
  if (/\bcurls?\b/.test(name)) return { primary: ["Biceps"] };
  if (/\b(?:triceps|skull crusher|rope push|pushdown)\b/.test(name)) return { primary: ["Triceps"] };
  if (/\b(?:squats?|leg press|split squat|lunges?|step ups?)\b/.test(name)) return { primary: ["Quads"], secondary: ["Glutes"] };
  if (/\b(?:deadlift|romanian|rdl|good morning|back extension)\b/.test(name)) return { primary: ["Hamstrings", "Glutes"], secondary: ["Upper back"] };
  if (/\bleg extension\b/.test(name)) return { primary: ["Quads"] };
  if (/\b(?:hip thrust|glute bridge)\b/.test(name)) return { primary: ["Glutes"], secondary: ["Hamstrings"] };
  if (/\bcalves?\b/.test(name)) return { primary: ["Calves"] };
  if (/\b(?:crunch|leg raise|plank|pallof|dead bug|ab wheel|ab rollout)\b/.test(name)) return { primary: ["Abs"] };
  return null;
};

export const coverageForLastDays = (state: TrainingState, days = 7): MuscleCoverage[] => {
  const totals = new Map<MuscleGroup, { effectiveSets: number; dates: Set<string> }>(groups.map((muscle) => [muscle, { effectiveSets: 0, dates: new Set() }]));
  state.workouts
    .filter((workout) => workout.status === "completed" && dateInWindow(workout.date, days))
    .forEach((workout) => workout.exercises.forEach((exercise) => {
      const targets = targetForCoverage(canonicalExerciseName(exercise.name, state.exerciseAliases), state.exerciseMuscleOverrides) ?? targetForCoverage(exercise.name, state.exerciseMuscleOverrides);
      if (!targets) return;
      const workingSets = exercise.sets.filter((set) => set.completed && !set.warmup && parseExactReps(performedReps(set)) !== null);
      if (!workingSets.length) return;
      for (const muscle of targets.primary) {
        const current = totals.get(muscle)!;
        current.effectiveSets += workingSets.length;
        current.dates.add(workout.date);
      }
      for (const muscle of targets.secondary ?? []) {
        const current = totals.get(muscle)!;
        current.effectiveSets += workingSets.length * 0.5;
        current.dates.add(workout.date);
      }
    }));
  return groups.map((muscle) => ({ muscle, effectiveSets: totals.get(muscle)!.effectiveSets, days: totals.get(muscle)!.dates.size }));
};

export const unmappedExerciseNamesLastDays = (state: TrainingState, days = 7) => {
  return [...new Set(state.workouts
    .filter((workout) => workout.status === "completed" && dateInWindow(workout.date, days))
    .flatMap((workout) => workout.exercises)
    .filter((exercise) => exercise.sets.some((set) => set.completed && !set.warmup && parseExactReps(performedReps(set)) !== null) && !(targetForCoverage(canonicalExerciseName(exercise.name, state.exerciseAliases), state.exerciseMuscleOverrides) ?? targetForCoverage(exercise.name, state.exerciseMuscleOverrides)))
    .map((exercise) => exercise.name))];
};

export const exerciseNamesNeedingCoverage = (state: TrainingState) => [...new Set(state.workouts
  .filter((workout) => workout.status === "completed")
  .flatMap((workout) => workout.exercises)
  .filter((exercise) => exercise.sets.some((set) => set.completed && !set.warmup && parseExactReps(performedReps(set)) !== null))
  .map((exercise) => exercise.name.trim())
  .filter((name) => name && !targetForCoverage(name, state.exerciseMuscleOverrides)))].sort((a, b) => a.localeCompare(b));

// Include saved/active workouts too; review is independent of completion.
export const exerciseMappingEntries = (state: TrainingState) => {
  const names = new Map<string, string>();
  state.workouts.forEach((workout) => workout.exercises.forEach((exercise) => {
    const name = exercise.name.trim();
    if (name && !names.has(exerciseKey(name))) names.set(exerciseKey(name), name);
  }));
  Object.entries(state.exerciseMuscleOverrides).forEach(([key, target]) => {
    if (target.primary.length && !target.deletedAt && !names.has(key)) names.set(key, key);
  });
  return [...names].map(([key, name]) => ({ key, name,
    reviewed: Boolean(state.exerciseMuscleOverrides[key]?.primary.length && !state.exerciseMuscleOverrides[key]?.deletedAt),
    target: targetForCoverage(name, state.exerciseMuscleOverrides),
  })).sort((a, b) => a.name.localeCompare(b.name));
};

export const coverageExerciseKey = exerciseKey;

import { hasCompletedActivityWork, performedDuration, performedDistance } from "./completion";
type ActivityTotals = { sessions: number; minutes: number; distanceKm: number; dates: string[] };
const emptyActivityTotals = (): ActivityTotals => ({ sessions: 0, minutes: 0, distanceKm: 0, dates: [] });

export const activityBreakdownForLastDays = (state: TrainingState, unit: Unit, days = 7) => {
  const result = { runs: emptyActivityTotals(), waterPolo: emptyActivityTotals(), rucks: { ...emptyActivityTotals(), loadDistance: 0, unit }, circuits: emptyActivityTotals() };
  state.workouts.filter((workout) => workout.status === "completed" && dateInWindow(workout.date, days)).forEach((workout) => {
    let loggedCircuit = false;
    workout.cardio.forEach((item) => {
      if (!hasCompletedActivityWork(item)) return;
      const totals = item.activityType === "run" ? result.runs : item.activityType === "water_polo" ? result.waterPolo : item.activityType === "ruck" ? result.rucks : item.activityType === "circuit" ? result.circuits : null;
      if (!totals) return;
      const minutes = performedDuration(item) ?? 0;
      const distance = performedDistance(item) ?? 0;
      totals.sessions += 1;
      totals.minutes += minutes;
      totals.distanceKm += distance;
      if (!totals.dates.includes(workout.date)) totals.dates.push(workout.date);
      if (totals === result.circuits) loggedCircuit = true;
      if (totals === result.rucks && item.ruckLoad !== null && distance > 0) result.rucks.loadDistance += convertWeight(item.ruckLoad, item.ruckLoadUnit, unit) * distance;
    });
    // A manually titled circuit still counts as a session when its movements
    // were logged as sets instead of as a circuit activity.
    if (!loggedCircuit && /\bcircuit\b/i.test(workout.name) && !/\bforce\b/i.test(workout.name) && !workout.cardio.some((item) => item.completed && item.activityType === "force") && workout.exercises.some((exercise) => exercise.sets.some((set) => set.completed))) {
      result.circuits.sessions += 1;
      result.circuits.dates.push(workout.date);
    }
  });
  return result;
};
