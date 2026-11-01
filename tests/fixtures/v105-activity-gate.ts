/**
 * Self-contained extract of Coach Loop v105's (commit d073438) backup gate,
 * for compat tests only. NEVER import code from a sibling worktree (the
 * v107 CI lesson: a test imported from ../../v105-gate and Pages failed).
 *
 * What v105 actually does with activity segments, verified from its source
 * (read-only) at v105-gate/app/persistence/training-validation.ts:39-53
 * and v105-gate/app/persistence/migrations.ts:66-75:
 * - activitySchema is a zod object with NO `segments` field and a
 *   `.passthrough()` tail, so unknown keys pass through untouched.
 * - normalizeLoadedState maps cardio with `{...makeCardio(...), ...activity}`,
 *   i.e. the whole activity object is spread, segments included.
 * Consequence: a v108 backup's labeled segments import in v105 VERBATIM
 * (labels preserved opaquely; v105 has no segment UI, so they are inert
 * there) — they are NOT stripped. The earlier "stripped" wording was
 * wrong for activities; this fixture pins the true behavior.
 * The settings gate below is the same extract v107's fixture used:
 * JSON parse, `version` required, evidenceVersion 1 or 2, and
 * settings.quickLogActivities (if present) must be a unique array drawn
 * from v105's exact enum — "walk" absent, so a walk-storing backup fails.
 */

const V105_QUICK_LOG = ["run", "swim", "bike", "ruck", "circuit", "soccer", "grappling", "yoga", "water_polo"];

export function parseBackupActivitiesV105(text: string): { activities: unknown[]; settings: unknown } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This JSON file is incomplete or corrupt"); }
  if (!raw || typeof raw !== "object" || !("version" in raw)) throw new Error("Choose a Coach Loop JSON backup");
  const obj = raw as { version?: unknown; evidenceVersion?: unknown; settings?: { quickLogActivities?: unknown }; workouts?: { cardio?: unknown[] }[] };
  if (obj.version !== 1 || (obj.evidenceVersion !== undefined && obj.evidenceVersion !== 1 && obj.evidenceVersion !== 2)) {
    throw new Error("This backup requires a different or newer Coach Loop version");
  }
  const quick = obj.settings?.quickLogActivities;
  if (quick !== undefined) {
    if (!Array.isArray(quick) || new Set(quick).size !== quick.length || quick.some(item => !V105_QUICK_LOG.includes(item as string))) {
      throw new Error("Backup contains invalid data: quickLogActivities");
    }
  }
  // Passthrough + whole-activity spread: activities arrive verbatim.
  const activities = (obj.workouts ?? []).flatMap(workout => workout.cardio ?? []);
  return { activities: structuredClone(activities), settings: obj.settings ?? {} };
}
