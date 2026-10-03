import { uid, type TrainingState } from "../domain/training-types";
import { mergeRestoredState } from "./cloud-sync";
import { validateSyncedState } from "./training-validation";
import { prepareLoadedState } from "./migrations";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export function parseBackup(text: string): TrainingState {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error("Backup is too large (maximum 10 MB)");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This JSON file is incomplete or corrupt"); }
  if (!raw || typeof raw !== "object" || !("version" in raw)) throw new Error("Choose a Coach Loop JSON backup");
  const obj = raw as { version?: unknown; evidenceVersion?: unknown };
  if (obj.version !== 1 || (obj.evidenceVersion !== undefined && obj.evidenceVersion !== 1 && obj.evidenceVersion !== 2)) throw new Error("This backup requires a different or newer Coach Loop version");
  try { return prepareLoadedState(raw); } catch (error) { throw new Error(`Backup contains invalid data: ${error instanceof Error ? error.message.slice(0, 220) : "check its records"}`); }
}
/** Deliberate recovery uses new IDs so existing tombstones still protect stale merges. */
export function recoverDeleted(current: TrainingState, backup: TrainingState): TrainingState {
  const copy = structuredClone(backup);
  for (const workout of copy.workouts) {
    const local = current.workouts.find(w => w.id === workout.id);
    if (current.deletedWorkoutIds.includes(workout.id)) { workout.id = uid("recovered"); delete workout.originKey; }
    if (local) {
      const replace = (id: string, deleted: string[] = []) => deleted.includes(id) ? uid("recovered") : id;
      workout.exercises.forEach(e => {
        const old = e.id; e.id = replace(old, local.deletedExerciseIds);
        const localExercise = local.exercises.find(x => x.id === old);
        e.sets.forEach(s => { s.id = replace(s.id, localExercise?.deletedSetIds); });
        workout.blockOrder.forEach(b => { if (b.id === old) b.id = e.id; });
      });
      workout.cardio.forEach(c => { const old = c.id; c.id = replace(old, local.deletedActivityIds); workout.blockOrder.forEach(b => { if (b.id === old) b.id = c.id; }); });
    }
  }
  copy.activeWorkoutId = null;
  return copy;
}
export function backupChanges(current: TrainingState, merged: TrainingState) {
  return {
    changed: merged.workouts.filter(w => { const prior = current.workouts.find(p => p.id === w.id); return prior && JSON.stringify(prior) !== JSON.stringify(w); }).length,
    sections: (["settings", "goals", "coachProfile", "bodyweightEntries", "waistEntries", "benchmarks", "exerciseAliases", "exerciseMuscleOverrides", "scheduleContext"] as const).filter(key => JSON.stringify(current[key]) !== JSON.stringify(merged[key])),
  };
}

export type RestoreMode = "merge" | "replace";
/** Replacement preserves the backup itself; merging retains newer local revisions. */
export function restoredState(current: TrainingState, backup: TrainingState, mode: RestoreMode = "merge", recover = false): TrainingState {
  const checked = validateSyncedState(backup);
  if (mode === "replace") return structuredClone(checked);
  return validateSyncedState(mergeRestoredState(current, recover ? recoverDeleted(current, checked) : checked));
}
