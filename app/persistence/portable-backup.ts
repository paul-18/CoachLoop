import type { TrainingState } from "../domain/training-types";
import { readEntity } from "./field-conflicts";

/** Export what the athlete can see, including unresolved edits kept only on this device. */
export function portableBackup(canonical: TrainingState, displayed: TrainingState): TrainingState {
  const backup = structuredClone(displayed);
  const newerThan = (original: unknown) => {
    const time = typeof original === "string" ? Date.parse(original) : 0;
    return new Date(Math.max(Date.now(), Number.isFinite(time) ? time + 1 : 0)).toISOString();
  };
  for (const conflict of canonical.pendingConflicts ?? []) {
    const path = conflict.fieldPath;
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "workouts" && parts[1]) {
      const workout = readEntity(backup, `/workouts/${parts[1]}`);
      if (workout) workout.updatedAt = newerThan(readEntity(canonical, `/workouts/${parts[1]}`)?.updatedAt);
      if (parts[2] && parts[3]) {
        const block = readEntity(backup, `/workouts/${parts[1]}/${parts[2]}/${parts[3]}`);
        if (block) block.updatedAt = newerThan(readEntity(canonical, `/workouts/${parts[1]}/${parts[2]}/${parts[3]}`)?.updatedAt);
      }
      if (parts[4] && parts[5]) {
        const child = readEntity(backup, `/workouts/${parts[1]}/${parts[2]}/${parts[3]}/${parts[4]}/${parts[5]}`);
        if (child) child.updatedAt = newerThan(readEntity(canonical, `/workouts/${parts[1]}/${parts[2]}/${parts[3]}/${parts[4]}/${parts[5]}`)?.updatedAt);
      }
    } else if (parts[0] === "settings") backup.settingsUpdatedAt = newerThan(canonical.settingsUpdatedAt);
    else if (parts[0] === "goals") backup.goalsUpdatedAt = newerThan(canonical.goalsUpdatedAt);
    else if (parts[0] === "coachProfile") backup.coachProfileUpdatedAt = newerThan(canonical.coachProfileUpdatedAt);
  }
  backup.resolvedConflictIds = [...new Set([...(backup.resolvedConflictIds ?? []), ...(backup.pendingConflicts ?? []).map((item) => item.id)])];
  backup.pendingConflicts = [];
  // The AI API key is a device secret: it never leaves this device inside a portable backup.
  backup.settings = { ...backup.settings, aiApiKey: undefined };
  return backup;
}
