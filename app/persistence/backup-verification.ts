import { parseBackupReview } from "./backup-tools";

/** Read-only inspection of a file the user actually selected. No storage imports
 * or callbacks: this cannot restore data or mark an export as externally saved. */
export function verifyBackup(text: string) {
  const { state, notices } = parseBackupReview(text);
  const dates = state.workouts.map(w => w.date);
  return {
    notices,
    version: state.version,
    evidenceVersion: state.evidenceVersion,
    workouts: state.workouts.length,
    completed: state.workouts.filter(w => w.status === "completed").length,
    planned: state.workouts.filter(w => w.status === "planned").length,
    active: state.workouts.filter(w => w.status === "active").length,
    skipped: state.workouts.filter(w => w.status === "skipped").length,
    sets: state.workouts.reduce((n, w) => n + w.exercises.reduce((s, e) => s + e.sets.length, 0), 0),
    activities: state.workouts.reduce((n, w) => n + w.cardio.length, 0),
    goals: state.goals.length,
    profilePresent: Boolean(state.coachProfile.trim()),
    bodyweightEntries: state.bodyweightEntries.length,
    waistEntries: state.waistEntries?.length ?? 0,
    benchmarks: state.benchmarks?.length ?? 0,
    firstDate: dates.reduce<string | null>((a, b) => a === null || b < a ? b : a, null),
    lastDate: dates.reduce<string | null>((a, b) => a === null || b > a ? b : a, null),
  };
}
