import { hyroxExport } from "../domain/hyrox";
import type { TrainingState, TrainingSet } from "../domain/training-types";
import { performedReps, performedWeight, performedDistance, performedDuration, exerciseIdentity } from "../domain/training-metrics";

import { hasCompletedActivityWork } from "../domain/completion";
const setDescription = (set: TrainingSet) => {
  const weight = performedWeight(set);
  const load = set.loadType === "bodyweight"
    ? weight !== null && set.weightMode === "added" ? `Bodyweight + ${weight} ${set.unit}` : "Bodyweight"
    : weight !== null ? `${weight} ${set.unit}${set.weightMode === "per_hand" ? " each" : set.weightMode === "added" ? " added" : ""}` : "Weight unrecorded";
  return `${load} × ${performedReps(set).trim() || "reps unrecorded"}${set.warmup ? " (warm-up)" : ""}`;
};

/** A readable personal record. Excludes plans, skipped work, and all notes. */
export function exportCompletedHistory(state: TrainingState, filter: { from?: string; to?: string; exercise?: string } = {}): string {
  const sessions = state.workouts
    .filter((workout) => workout.status === "completed")
    .filter((workout) => !filter.from || workout.date >= filter.from)
    .filter((workout) => !filter.to || workout.date <= filter.to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const lines: string[] = ["COACH LOOP — COMPLETED TRAINING", ""];

  for (const workout of sessions) {
    if (workout.hyrox) {
      if (!filter.exercise && workout.hyrox.segments.some((s) => s.splitMs !== null)) lines.push(`${workout.date} — ${workout.name}`, ...hyroxExport(workout), "");
      continue;
    }
    const items: string[] = [];
    for (const exercise of workout.exercises) {
      if (filter.exercise && exerciseIdentity(exercise.name, state.exerciseAliases) !== exerciseIdentity(filter.exercise, state.exerciseAliases)) continue;
      const groups: Array<{ label: string; count: number }> = [];
      for (const set of exercise.sets.filter((candidate) => candidate.completed)) {
        const label = setDescription(set);
        const last = groups.at(-1);
        if (last?.label === label) last.count++;
        else groups.push({ label, count: 1 });
      }
      if (groups.length) items.push(`${exercise.name}: ${groups.map(({ label, count }) => `${label}${count > 1 ? ` (${count} sets)` : ""}`).join("; ")}`);
    }
    for (const activity of (filter.exercise ? [] : workout.cardio).filter(hasCompletedActivityWork)) {
      const details = [
        performedDistance(activity) !== null ? `${performedDistance(activity)} km` : null,
        performedDuration(activity) !== null ? `${performedDuration(activity)} min` : null,
        activity.activityType === "ruck" && activity.ruckLoad !== null ? `${activity.ruckLoad} ${activity.ruckLoadUnit} pack` : null,
        activity.efforts?.some((effort) => effort.completed) ? activity.efforts.filter((effort) => effort.completed).map((effort) => [effort.actualDistanceM !== null ? `${effort.actualDistanceM} m` : "", effort.actualLoad !== null ? `${effort.actualLoad} ${activity.effortLoadUnit ?? "lb"}` : "", effort.actualDurationSec !== null ? `${effort.actualDurationSec} sec` : ""].filter(Boolean).join(" · ") || "effort").join("; ") : null,
      ].filter(Boolean);
      items.push(`${activity.name}: ${details.join(" · ") || "completed"}`);
    }
    if (items.length) lines.push(`${workout.date} — ${filter.exercise || workout.name}`, ...items.map((item) => `  ${item}`), "");
  }

  return lines.length === 2 ? "No completed records match these filters.\n" : lines.join("\n").trimEnd() + "\n";
}
