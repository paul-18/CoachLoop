import type { CardioEntry, ExerciseBlock, ExerciseMuscleTarget, TrainingSet, TrainingState, WorkoutSession } from "../domain/training-types";
import type { NutritionDayLog } from "../domain/nutrition-types";
import { normalizedBlockOrder } from "../domain/block-order";
export type SyncStatus = "connecting" | "synced" | "saving" | "offline" | "error";

const workoutTime = (workout: WorkoutSession) =>
  workout.updatedAt ??
  workout.completedAt ??
  workout.skippedAt ??
  workout.startedAt ??
  workout.createdAt;

const mergeById = <T extends { id: string; updatedAt: string }>(older: T[], newer: T[]) => {
  const items = new Map<string, T>();
  for (const item of [...older, ...newer]) {
    const current = items.get(item.id);
    if (!current || item.updatedAt >= current.updatedAt) items.set(item.id, item);
  }
  return [...items.values()];
};

const pickNewestSection = <T>(local: T, remote: T, localUpdatedAt?: string, remoteUpdatedAt?: string) =>
  (localUpdatedAt ?? "1970-01-01T00:00:00.000Z") >= (remoteUpdatedAt ?? "1970-01-01T00:00:00.000Z")
    ? local
    : remote;

const mergeExercise = (left: ExerciseBlock, right: ExerciseBlock): ExerciseBlock => {
  const newer = right.updatedAt >= left.updatedAt ? right : left;
  const deletedSetIds = [...new Set([...(left.deletedSetIds ?? []), ...(right.deletedSetIds ?? [])])];
  return { ...newer, deletedSetIds, sets: mergeById<TrainingSet>(left.sets, right.sets).filter((set) => !deletedSetIds.includes(set.id)) };
};

const mergeWorkout = (left: WorkoutSession, right: WorkoutSession): WorkoutSession => {
  const newer = workoutTime(right) >= workoutTime(left) ? right : left;
  const deletedExerciseIds = [...new Set([...(left.deletedExerciseIds ?? []), ...(right.deletedExerciseIds ?? [])])];
  const deletedActivityIds = [...new Set([...(left.deletedActivityIds ?? []), ...(right.deletedActivityIds ?? [])])];
  const exercises = new Map<string, ExerciseBlock>();
  for (const exercise of [...left.exercises, ...right.exercises]) {
    const current = exercises.get(exercise.id);
    exercises.set(exercise.id, current ? mergeExercise(current, exercise) : exercise);
  }
  const merged = {
    ...newer,
    deletedExerciseIds,
    deletedActivityIds,
    exercises: [...exercises.values()].filter((exercise) => !deletedExerciseIds.includes(exercise.id)),
    cardio: mergeById<CardioEntry>(left.cardio, right.cardio).filter((activity) => !deletedActivityIds.includes(activity.id)),
  };
  return { ...merged, blockOrder: normalizedBlockOrder(merged) };
};

export const mergeTrainingStates = (
  local: TrainingState,
  remote: TrainingState,
): TrainingState => {
  const deletedWorkoutIds = [...new Set([
    ...(local.deletedWorkoutIds ?? []),
    ...(remote.deletedWorkoutIds ?? []),
  ])];
  const deleted = new Set(deletedWorkoutIds);
  const workouts = new Map<string, WorkoutSession>();

  for (const workout of [...remote.workouts, ...local.workouts]) {
    if (deleted.has(workout.id)) continue;
    const current = workouts.get(workout.id);
    workouts.set(workout.id, current ? mergeWorkout(current, workout) : workout);
  }

  // Provenance is not identity: distinct IDs must retain their own evidence.
  const deduped = [...workouts.values()];
  const exerciseMuscleOverrides = { ...(remote.exerciseMuscleOverrides ?? {}) };
  Object.entries(local.exerciseMuscleOverrides ?? {}).forEach(([key, localTarget]) => {
    const remoteTarget = exerciseMuscleOverrides[key];
    const localTime = localTarget.updatedAt ?? "1970-01-01T00:00:00.000Z";
    const remoteTime = remoteTarget?.updatedAt ?? "1970-01-01T00:00:00.000Z";
    if (!remoteTarget || localTime >= remoteTime) exerciseMuscleOverrides[key] = localTarget;
  });
  const mergeScheduleItems = <T extends { id: string; updatedAt?: string }>(localItems: T[] = [], remoteItems: T[] = []) => {
    const merged = new Map<string, T>();
    for (const item of [...remoteItems, ...localItems]) {
      const current = merged.get(item.id);
      if (!current || (item.updatedAt ?? "1970-01-01T00:00:00.000Z") >= (current.updatedAt ?? "1970-01-01T00:00:00.000Z")) merged.set(item.id, item);
    }
    return [...merged.values()];
  };
  const scheduleContext = {
    events: mergeScheduleItems(local.scheduleContext?.events, remote.scheduleContext?.events),
    phases: mergeScheduleItems(local.scheduleContext?.phases, remote.scheduleContext?.phases),
  };
  const activeIds = new Set(deduped.filter((workout) => workout.status === "active").map((workout) => workout.id));
  const activeWorkoutId = [local.activeWorkoutId, remote.activeWorkoutId]
    .find((id): id is string => typeof id === "string" && activeIds.has(id))
    ?? (activeIds.size === 1 ? [...activeIds][0] : null);

  const bodyweights = new Map<string, TrainingState["bodyweightEntries"][number]>();
  for (const entry of [...(remote.bodyweightEntries ?? []), ...(local.bodyweightEntries ?? [])]) {
    const current = bodyweights.get(entry.date);
    if (!current || entry.updatedAt >= current.updatedAt) bodyweights.set(entry.date, entry);
  }

  const waists = new Map<string, NonNullable<TrainingState["waistEntries"]>[number]>();
  for (const entry of [...(remote.waistEntries ?? []), ...(local.waistEntries ?? [])]) {
    const current = waists.get(entry.date);
    if (!current || entry.updatedAt >= current.updatedAt) waists.set(entry.date, entry);
  }
  const loadIncrements = {...remote.loadIncrements};
  for (const [key, value] of Object.entries(local.loadIncrements ?? {})) {
    if (!loadIncrements[key] || value.updatedAt >= loadIncrements[key].updatedAt) loadIncrements[key] = value;
  }
  const goals = pickNewestSection(local.goals, remote.goals, local.goalsUpdatedAt, remote.goalsUpdatedAt);
  const coachProfile = pickNewestSection(local.coachProfile, remote.coachProfile, local.coachProfileUpdatedAt, remote.coachProfileUpdatedAt);
  const settings = pickNewestSection(local.settings, remote.settings, local.settingsUpdatedAt, remote.settingsUpdatedAt);
  const nutritionLogs = new Map<string, NutritionDayLog>();
  for (const entry of [...(remote.nutritionLogs ?? []), ...(local.nutritionLogs ?? [])]) {
    const current = nutritionLogs.get(entry.date);
    if (!current) { nutritionLogs.set(entry.date, entry); continue; }
    const meals = new Map(current.meals.map(meal => [meal.id, meal]));
    for (const meal of entry.meals) meals.set(meal.id, meal);
    nutritionLogs.set(entry.date, { ...current, targetKcal: entry.targetKcal, meals: [...meals.values()] });
  }
  return {
    ...remote,
    ...local,
    waistEntries: [...waists.values()],
    loadIncrements,
    workouts: deduped,
    pendingConflicts: [...new Map([...(remote.pendingConflicts ?? []), ...(local.pendingConflicts ?? [])].map((item) => [item.id, item])).values()].filter((item) => !new Set([...(local.resolvedConflictIds ?? []), ...(remote.resolvedConflictIds ?? [])]).has(item.id)),
    resolvedConflictIds: [...new Set([...(local.resolvedConflictIds ?? []), ...(remote.resolvedConflictIds ?? [])])],
    deletedWorkoutIds,
    bodyweightEntries: [...bodyweights.values()].sort((a, b) => a.date.localeCompare(b.date)),
    nutritionLogs: [...nutritionLogs.values()].sort((a, b) => a.date.localeCompare(b.date)),
    benchmarks: mergeScheduleItems(local.benchmarks, remote.benchmarks).map((item) => {
      const left = local.benchmarks?.find((entry) => entry.id === item.id);
      const right = remote.benchmarks?.find((entry) => entry.id === item.id);
      const legacy = [left, right].flatMap((entry) => entry?.result && entry.testedOn && !(entry.attempts ?? []).some((attempt) => attempt.date === entry.testedOn && attempt.result === entry.result) ? [{ id: `legacy-${entry.id}-${entry.testedOn}`, date: entry.testedOn, result: entry.result, protocol: entry.protocol, updatedAt: entry.updatedAt }] : []);
      const attempts = new Map<string, NonNullable<typeof item.attempts>[number]>();
      for (const attempt of [...legacy, ...(left?.attempts ?? []), ...(right?.attempts ?? [])]) {
        const prior = attempts.get(attempt.id);
        if (!prior || attempt.updatedAt >= prior.updatedAt) attempts.set(attempt.id, attempt);
      }
      const ordered = [...attempts.values()].sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt));
      const latest = ordered.at(-1);
      return { ...item, result: latest?.result ?? item.result, testedOn: latest?.date ?? item.testedOn, attempts: ordered };
    }),
    activeWorkoutId: deduped.some((workout) => workout.id === activeWorkoutId && workout.status === "active")
      ? activeWorkoutId
      : null,
    goals,
    goalsUpdatedAt: pickNewestSection(local.goalsUpdatedAt, remote.goalsUpdatedAt, local.goalsUpdatedAt, remote.goalsUpdatedAt),
    coachProfile,
    coachProfileUpdatedAt: pickNewestSection(local.coachProfileUpdatedAt, remote.coachProfileUpdatedAt, local.coachProfileUpdatedAt, remote.coachProfileUpdatedAt),
    exerciseAliases: { ...remote.exerciseAliases, ...local.exerciseAliases },
    exerciseMuscleOverrides: exerciseMuscleOverrides as Record<string, ExerciseMuscleTarget>,
    scheduleContext,
    settings,
    settingsUpdatedAt: pickNewestSection(local.settingsUpdatedAt, remote.settingsUpdatedAt, local.settingsUpdatedAt, remote.settingsUpdatedAt),
  };
};

/** Merge an imported backup into current state so stale backups cannot undo deletes or newer edits. */
export const mergeRestoredState = (current: TrainingState, backup: TrainingState): TrainingState =>
  mergeTrainingStates(current, backup);
