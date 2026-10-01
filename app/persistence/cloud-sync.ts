import type { CardioEntry, ExerciseBlock, ExerciseMuscleTarget, TrainingSet, TrainingState, WorkoutSession } from "../domain/training-types";
import { saveTrainingState } from "./training-storage";
import { z } from "zod";
import { validateLocalState } from "./training-validation";

export type SyncStatus = "connecting" | "synced" | "saving" | "offline" | "error";

export type CloudSnapshot = {
  state: TrainingState | null;
  revision: number;
  updatedAt: string | null;
  conflict?: boolean;
  generation: string | null;
};

export class SyncError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
  get retryable() { return this.status === 429 || this.status >= 500; }
}

const envelope = z.object({
  state: z.unknown().optional(), revision: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(), generation: z.string().nullable(),
});
const readResponse = async (response: Response): Promise<CloudSnapshot> => {
  const parsed = envelope.parse(await response.json());
  return { state: parsed.state == null ? null : validateLocalState(parsed.state), revision: parsed.revision, updatedAt: parsed.updatedAt, generation: parsed.generation };
};
const errorResponse = async (response: Response) => {
  let detail: { error?: string; code?: string } = {};
  try { detail = await response.json() as typeof detail; } catch { /* A proxy may return HTML. */ }
  return new SyncError(detail.error ?? `Sync failed (${response.status})`, response.status, detail.code);
};

export const stateHash = (state: TrainingState) => {
  return JSON.stringify(state);
};

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
  return {
    ...newer,
    deletedExerciseIds,
    deletedActivityIds,
    exercises: [...exercises.values()].filter((exercise) => !deletedExerciseIds.includes(exercise.id)),
    cardio: mergeById<CardioEntry>(left.cardio, right.cardio).filter((activity) => !deletedActivityIds.includes(activity.id)),
  };
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

  const originKeys = new Map<string, WorkoutSession>();
  for (const workout of workouts.values()) {
    if (!workout.originKey) continue;
    const current = originKeys.get(workout.originKey);
    if (!current || workoutTime(workout) >= workoutTime(current)) {
      originKeys.set(workout.originKey, workout);
    }
  }

  const deduped = [...workouts.values()].filter(
    (workout) => !workout.originKey || originKeys.get(workout.originKey)?.id === workout.id,
  );
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
    benchmarks: mergeScheduleItems(local.benchmarks, remote.benchmarks).map((item) => {
      const left = local.benchmarks?.find((entry) => entry.id === item.id);
      const right = remote.benchmarks?.find((entry) => entry.id === item.id);
      const legacy = [left, right].flatMap((entry) => entry?.result && entry.testedOn && !(entry.attempts ?? []).some((attempt) => attempt.date === entry.testedOn && attempt.result === entry.result) ? [{ id: `legacy-${entry.id}-${entry.testedOn}`, date: entry.testedOn, result: entry.result, protocol: entry.protocol, updatedAt: entry.updatedAt }] : []);
      const attempts = new Map([...legacy, ...(left?.attempts ?? []), ...(right?.attempts ?? [])].map((attempt) => [attempt.id, attempt]));
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

export const getCloudSnapshot = async (): Promise<CloudSnapshot> => {
  const response = await fetch("/api/sync", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw await errorResponse(response);
  return readResponse(response);
};

export const putCloudSnapshot = async (
  state: TrainingState,
  expectedRevision: number,
  generation: string,
): Promise<CloudSnapshot> => {
  const response = await fetch("/api/sync", {
    method: "PUT",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, expectedRevision, generation }),
  });
  if (response.status === 409) {
    const detail = await response.clone().json() as { code?: string };
    if (detail.code === "DATASET_RESET") throw new SyncError("This log was reset on another device.", 409, "DATASET_RESET");
    return { ...await readResponse(response), conflict: true };
  }
  if (!response.ok) throw await errorResponse(response);
  const result = await response.json() as { revision: number; updatedAt: string; generation: string };
  return { state, revision: result.revision, updatedAt: result.updatedAt, generation: result.generation };
};

/** Upload precisely the state that first completed an IndexedDB transaction. */
export async function persistThenUpload(state: TrainingState, expectedRevision: number, generation: string): Promise<CloudSnapshot> {
  const candidate = structuredClone(state);
  await saveTrainingState(candidate);
  return putCloudSnapshot(candidate, expectedRevision, generation);
}

export async function resetCloudSnapshot(state: TrainingState, expectedRevision: number, generation: string): Promise<CloudSnapshot> {
  const response = await fetch("/api/sync", {
    method: "POST", signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, expectedRevision, generation }),
  });
  if (!response.ok) throw await errorResponse(response);
  return readResponse(response);
}
