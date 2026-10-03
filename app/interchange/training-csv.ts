import type { TrainingState } from "../domain/training-types";
import { performedDuration, performedDistance, hasCompletedActivityWork } from "../domain/completion";
import { csvSetEffort, toCsv } from "./csv-export";
export function trainingCsvRows(state: TrainingState): string[][] {
  const rows = [["date", "workout", "record_status", "type", "exercise_or_activity", "set", "load_type", "weight_mode", "planned_weight", "actual_weight", "unit", "planned_reps", "actual_reps", "completed_as_planned", "rpe_or_effort", "duration_min", "distance_km", "ruck_load", "average_hr", "elevation_m", "pace", "notes", "skip_reason", "efforts", "warmup"]];
  const row = (values: Record<string, string>) => rows.push(rows[0].map(key => values[key] ?? ""));
  for (const w of state.workouts) {
    if (w.status === "skipped") { row({ date: w.date, workout: w.name, record_status: "skipped", notes: w.notes, skip_reason: w.skipReason }); continue; }
    if (w.status !== "completed") continue;
    w.exercises.forEach(e => e.sets.forEach((s, i) => row({ date: w.date, workout: w.name, record_status: s.completed ? "completed" : s.skipped ? "skipped" : "incomplete", type: "strength", exercise_or_activity: e.name, set: String(i + 1), load_type: s.loadType, weight_mode: s.weightMode, planned_weight: s.plannedWeight?.toString() ?? "", actual_weight: s.actualWeight?.toString() ?? "", unit: s.unit, planned_reps: s.plannedReps, actual_reps: s.actualReps, completed_as_planned: String(s.completedAsPlanned), rpe_or_effort: csvSetEffort(s), notes: `${e.notes} ${s.notes}`.trim(), warmup: String(s.warmup) })));
    w.cardio.forEach(c => row({ date: w.date, workout: w.name, record_status: c.completed ? "completed" : hasCompletedActivityWork(c) ? "partial" : "incomplete", type: c.activityType, exercise_or_activity: c.name, completed_as_planned: String(c.completedAsPlanned), rpe_or_effort: c.effort, duration_min: hasCompletedActivityWork(c) ? performedDuration(c)?.toString() ?? "" : "", distance_km: hasCompletedActivityWork(c) ? performedDistance(c)?.toString() ?? "" : "", ruck_load: c.ruckLoad !== null ? `${c.ruckLoad} ${c.ruckLoadUnit}` : "", average_hr: c.averageHr?.toString() ?? "", elevation_m: c.elevationM?.toString() ?? "", pace: c.pace, notes: c.notes, efforts: (c.efforts ?? []).map((e, i) => `${i + 1}: ${e.completed ? "done" : "not done"}${e.completed && e.actualDistanceM !== null ? ` ${e.actualDistanceM} m` : ""}${e.completed && e.actualLoad !== null ? ` ${e.actualLoad} ${c.effortLoadUnit ?? "lb"}` : ""}${e.completed && e.actualDurationSec !== null ? ` ${e.actualDurationSec} sec` : ""}`).join("; ") }));
  }
  return rows;
}
export const exportTrainingCsv = (state: TrainingState) => toCsv(trainingCsvRows(state));
