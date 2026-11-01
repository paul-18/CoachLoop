import { uid, type TrainingState } from "../domain/training-types";
import { mergeRestoredState } from "./cloud-sync";
import { validateSyncedState } from "./training-validation";
import { prepareLoadedState } from "./migrations";
import { APP_RELEASE } from "../app-release";
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const LARGE_BACKUP_BYTES = 10 * 1024 * 1024;
const checkBackupSize = (text: string) => {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error("Backup is too large (maximum 50 MB). Keep your log; do not reset or clear storage. A split-backup export is needed for logs this large.");
};
/** The same size boundary applies on export and restore: never label an unusable file a full backup. */
export function serializeBackup(state: TrainingState): string {
  const text = JSON.stringify({ ...validateSyncedState(state), writtenByRelease: APP_RELEASE }, null, 2);
  checkBackupSize(text);
  return text;
}
export function parseBackup(text: string): TrainingState { return parseBackupReview(text).state; }
/** Returns migration disclosures without writing or mutating the selected file. */
export function parseBackupReview(text: string): { state: TrainingState; notices: string[]; writtenByRelease: string | null; newerReleaseWarning: string | null } {
  checkBackupSize(text);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This JSON file is incomplete or corrupt"); }
  if (!raw || typeof raw !== "object" || !("version" in raw)) throw new Error("Choose a Coach Loop JSON backup");
  const obj = raw as { version?: unknown; evidenceVersion?: unknown; writtenByRelease?: unknown };
  if ("format" in raw && raw.format === "coach-loop-recovery") throw new Error("Choose an individual checkpoint JSON, not the diagnostic recovery bundle");
  if (obj.version !== 1 || (obj.evidenceVersion !== undefined && obj.evidenceVersion !== 1 && obj.evidenceVersion !== 2)) throw new Error("This backup requires a different or newer Coach Loop version");
  try {
    const stateInput = { ...(raw as Record<string, unknown>) };
    delete stateInput.writtenByRelease;
    const state = prepareLoadedState(stateInput);
    const notices: string[] = [];
    if (obj.evidenceVersion !== 2) {
      notices.push("Older backup: supported legacy fields and training evidence were migrated. Review the preview before restoring.");
      const original = raw as { bodyweightEntries?: { updatedAt?: unknown }[]; waistEntries?: { updatedAt?: unknown }[] };
      const count = [...(original.bodyweightEntries ?? []), ...(original.waistEntries ?? [])].filter(entry => entry.updatedAt === undefined).length;
      if (count) notices.push(`${count} legacy measurement timestamp(s) were missing. Their measurement dates at midnight UTC are used, rather than today's date. Merge can retain newer local measurements; Complete restore uses this backup.`);
    }
    const writtenByRelease = typeof obj.writtenByRelease === "string" ? obj.writtenByRelease : null;
    const writtenNumber = releaseNumber(writtenByRelease);
    const currentNumber = releaseNumber(APP_RELEASE);
    const newerReleaseWarning = writtenNumber !== null && currentNumber !== null && writtenNumber > currentNumber
      ? `This backup was written by Coach Loop ${writtenByRelease}, newer than this release (${APP_RELEASE}). Some newer details may not appear here.`
      : null;
    return { state, notices, writtenByRelease, newerReleaseWarning };
  } catch (error) { throw new Error(`Backup contains invalid data: ${error instanceof Error ? error.message.slice(0, 220) : "check its records"}`); }
}
function releaseNumber(value: string | null): number | null {
  const match = value?.trim().match(/^v(\d+(?:\.\d+)*)$/i);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
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
