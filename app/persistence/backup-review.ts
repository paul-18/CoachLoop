import type { TrainingState, WorkoutSession } from "../domain/training-types";
import { restoredState, type RestoreMode } from "./backup-tools";

export interface ReviewedRestore { base: TrainingState; next: TrainingState }

/** Catch merge failures inside the dialog; replacement and Cancel remain usable. */
export function reviewRestore(base: TrainingState, backup: TrainingState, mode: RestoreMode, recover: boolean) {
  try { return { review: { base, next: restoredState(base, backup, mode, recover) }, error: "" }; }
  catch (error) { return { review: null, error: error instanceof Error ? error.message : "This merge could not be reviewed" }; }
}

const display = (value: unknown) => value === undefined ? "not set" : JSON.stringify(value);
const fields = (before: object, after: object, prefix: string) => {
  const left = before as Record<string, unknown>, right = after as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter(key => key !== "updatedAt" && key !== "id" && display(left[key]) !== display(right[key]))
    .map(key => `${prefix}${key}: ${display(left[key])} → ${display(right[key])}`);
};

function workoutDifferences(before: WorkoutSession, after: WorkoutSession) {
  const { exercises: le, cardio: lc, ...lh } = before;
  const { exercises: re, cardio: rc, ...rh } = after;
  const changes = fields(lh, rh, "Workout · ");
  for (const id of new Set([...le, ...re].map(e => e.id))) {
    const left = le.find(e => e.id === id), right = re.find(e => e.id === id);
    if (!left || !right) { changes.push(`${(left ?? right)!.name}: ${left ? "removed" : "added"} · ${display((left ?? right)!.sets)}`); continue; }
    const { sets: ls, ...lb } = left, { sets: rs, ...rb } = right;
    changes.push(...fields(lb, rb, `${right.name} · `));
    for (const setId of new Set([...ls, ...rs].map(s => s.id))) {
      const l = ls.find(s => s.id === setId), r = rs.find(s => s.id === setId);
      const index = (r ? rs : ls).findIndex(s => s.id === setId) + 1;
      const label = `${right.name}, set ${index} · `;
      if (!l || !r) changes.push(`${label}${l ? "removed" : "added"}: ${display(l ?? r)}`);
      else changes.push(...fields(l, r, label));
    }
  }
  for (const id of new Set([...lc, ...rc].map(a => a.id))) {
    const l = lc.find(a => a.id === id), r = rc.find(a => a.id === id);
    if (!l || !r) changes.push(`${(l ?? r)!.name}: ${l ? "removed" : "added"} · ${display(l ?? r)}`);
    else changes.push(...fields(l, r, `${r.name} · `));
  }
  return changes;
}

export function restoreDetails(base: TrainingState, next: TrainingState) {
  return [...new Set([...base.workouts, ...next.workouts].map(w => w.id))].flatMap(id => {
    const before = base.workouts.find(w => w.id === id), after = next.workouts.find(w => w.id === id);
    const lines = before && after ? workoutDifferences(before, after) : [`${before ? "Removed" : "Added"} workout: ${display(before ?? after)}`];
    return lines.length ? [{ id, name: (after ?? before)!.name, date: (after ?? before)!.date, lines }] : [];
  });
}

export function sharedProvenance(state: TrainingState) {
  const groups = new Map<string, WorkoutSession[]>();
  for (const w of state.workouts) if (w.originKey) groups.set(w.originKey, [...(groups.get(w.originKey) ?? []), w]);
  return [...groups.values()].filter(group => group.length > 1);
}
