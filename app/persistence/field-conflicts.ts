import { mergeTrainingStates } from "./cloud-sync";
import { uid, type FieldConflict, type TrainingState } from "../domain/training-types";

type Entity = Record<string, unknown>;
const asEntity = (value: unknown): Entity | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Entity : null;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const segment = (value: string) => encodeURIComponent(value);

export type MergeResult<T> =
  | { conflict: false; value: T }
  | { conflict: true; base: T; local: T; remote: T };

export function mergeField<T>(base: T, local: T, remote: T): MergeResult<T> {
  if (same(local, remote)) return { conflict: false, value: local };
  if (same(local, base)) return { conflict: false, value: remote };
  if (same(remote, base)) return { conflict: false, value: local };
  return { conflict: true, base, local, remote };
}

/** Stable entity paths address array elements by ID, never by array position. */
export function readEntity(state: TrainingState, path: string): Entity | null {
  let node: unknown = state;
  for (const part of path.split("/").filter(Boolean).map(decodeURIComponent)) {
    node = Array.isArray(node)
      ? node.find((item) => asEntity(item)?.id === part)
      : asEntity(node)?.[part];
    if (node === undefined) return null;
  }
  return asEntity(node);
}

export function writeConflictValue(state: TrainingState, path: string, value: unknown): boolean {
  const slash = path.lastIndexOf("/");
  const node = readEntity(state, path.slice(0, slash));
  if (!node) return false;
  node[decodeURIComponent(path.slice(slash + 1))] = value;
  return true;
}

const skip = new Set([
  "id", "createdAt", "updatedAt", "completedAt", "startedAt", "skippedAt",
  "sets", "exercises", "cardio", "events", "phases", "benchmarks", "blockOrder",
  "deletedSetIds", "deletedActivityIds", "deletedExerciseIds",
  "pendingConflicts", "resolvedConflictIds",
]);

export function mergeConcurrentState(
  base: TrainingState | null,
  local: TrainingState,
  remote: TrainingState,
  deviceId: string,
): { state: TrainingState; raised: FieldConflict[] } {
  const state = mergeTrainingStates(local, remote);
  const resolved = new Set([...(local.resolvedConflictIds ?? []), ...(remote.resolvedConflictIds ?? [])]);
  const pending = new Map<string, FieldConflict>();
  for (const item of [...(remote.pendingConflicts ?? []), ...(local.pendingConflicts ?? [])]) {
    if (!resolved.has(item.id)) pending.set(item.id, item);
  }
  const raised: FieldConflict[] = [];
  if (base) {
    const compare = (path: string, recordId: string, only?: string[]) => {
      const b = readEntity(base, path);
      const l = readEntity(local, path);
      const r = readEntity(remote, path);
      const destination = readEntity(state, path);
      if (!b || !l || !r || !destination) return;
      for (const field of only ?? [...new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])]) {
        if (skip.has(field)) continue;
        const outcome = mergeField(b[field], l[field], r[field]);
        if (!outcome.conflict) {
          destination[field] = outcome.value;
          continue;
        }
        // The server's existing value is canonical; this device's value is local-only.
        destination[field] = outcome.remote;
        const fieldPath = `${path}/${segment(field)}`;
        const existing = [...pending.values()].find((item) => item.fieldPath === fieldPath && same(item.base, outcome.base));
        if (existing) continue;
        const conflict: FieldConflict = {
          id: uid("conflict"), recordId, fieldPath,
          base: outcome.base, remoteValue: outcome.remote,
          raisingDeviceId: deviceId, raisingDeviceValue: outcome.local,
          createdAt: new Date().toISOString(),
        };
        pending.set(conflict.id, conflict);
        raised.push(conflict);
      }
    };
    compare("", "profile", ["coachProfile", "goals"]);
    compare("/settings", "settings");
    compare("/exerciseAliases", "aliases");
    compare("/loadIncrements", "increments");
    compare("/exerciseMuscleOverrides", "muscle-mapping");
    for (const workout of base.workouts) {
      const workoutPath = `/workouts/${segment(workout.id)}`;
      compare(workoutPath, workout.id);
      for (const exercise of workout.exercises) {
        const exercisePath = `${workoutPath}/exercises/${segment(exercise.id)}`;
        compare(exercisePath, exercise.id);
        for (const set of exercise.sets) compare(`${exercisePath}/sets/${segment(set.id)}`, set.id);
      }
      for (const activity of workout.cardio) compare(`${workoutPath}/cardio/${segment(activity.id)}`, activity.id);
    }
    for (const section of ["bodyweightEntries", "waistEntries"] as const) {
      for (const item of base[section] ?? []) compare(`/${section}/${segment(item.id)}`, item.id);
    }
    for (const section of ["events", "phases"] as const) {
      for (const item of base.scheduleContext[section]) compare(`/scheduleContext/${section}/${segment(item.id)}`, item.id);
    }
    for (const item of base.benchmarks ?? []) compare(`/benchmarks/${segment(item.id)}`, item.id);
  }
  state.pendingConflicts = [...pending.values()];
  state.resolvedConflictIds = [...resolved];
  return { state, raised };
}

export function projectLocalOverrides(state: TrainingState, overrides: Record<string, unknown>): TrainingState {
  const projected = structuredClone(state);
  for (const conflict of state.pendingConflicts ?? []) {
    if (Object.hasOwn(overrides, conflict.id)) {
      writeConflictValue(projected, conflict.fieldPath, overrides[conflict.id]);
    }
  }
  return projected;
}

export function resolveFieldConflict(state: TrainingState, id: string, value: unknown): TrainingState {
  const next = structuredClone(state);
  const conflict = next.pendingConflicts?.find((item) => item.id === id);
  if (!conflict || !writeConflictValue(next, conflict.fieldPath, value)) return state;
  const parent = readEntity(next, conflict.fieldPath.slice(0, conflict.fieldPath.lastIndexOf("/")));
  if (parent && "updatedAt" in parent) parent.updatedAt = new Date().toISOString();
  if (conflict.fieldPath.startsWith("/settings/")) next.settingsUpdatedAt = new Date().toISOString();
  if (conflict.fieldPath === "/coachProfile") next.coachProfileUpdatedAt = new Date().toISOString();
  if (conflict.fieldPath === "/goals") next.goalsUpdatedAt = new Date().toISOString();
  next.pendingConflicts = next.pendingConflicts?.filter((item) => item.id !== id);
  next.resolvedConflictIds = [...new Set([...(next.resolvedConflictIds ?? []), id])];
  return next;
}
