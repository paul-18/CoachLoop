import { performedDuration, performedDistance, hasTrainingEvidence } from "../domain/completion";
import { hyroxExport } from "../domain/hyrox";
import { FITLOG_INSTRUCTIONS, FITLOG_REMINDER } from "./fitlog";
import { formatLoad, formatPerformedSet, strengthRecords } from "../domain/training-metrics";
import { benchmarkDueDate } from "../domain/benchmarks";
import { localDate } from "../domain/training-types";
import { localDateDaysEarlier } from "../domain/training-insights";
import type {
  CoachOptions,
  TrainingSet,
  TrainingState,
  WorkoutSession,
} from "../domain/training-types";

export const DEFAULT_COACH_PROFILE = `COACHING PREFERENCES
Act as a long-term strength, physique, running, and conditioning coach. Use the completed training history, goals, bodyweight entries, and schedule provided in each brief; do not assume planned workouts were completed.

Account for accumulated training load, recovery, sleep, injuries, travel, and other scheduled activity when included. Aim for challenging, productive training without junk volume.

Be direct. Recommend the next useful session from the actual recent history, explain the reasoning briefly, and return exactly one importable FITLOG workout when requested. Treat skipped sessions as skipped and preserve the distinction between planned and completed work.

Add durable personal preferences in the Coach profile field. Add goals in Training goals. The app includes those saved values and relevant workout history in the brief.`;
const plannedSetLine = (set: TrainingSet) => {
  const load = formatLoad(set.loadType, set.plannedWeight, set.unit, set.weightMode);
  const effort = set.plannedRpe
    ? ` @ target RPE ${set.plannedRpe}`
    : set.plannedRir
      ? ` @ target RIR ${set.plannedRir}`
      : "";
  return `${load} × ${set.plannedReps || "reps not set"}${effort}${set.warmup ? " (warm-up)" : ""}`;
};

const compactSetLines = (sets: TrainingSet[], includePlanned: boolean, plannedWorkout: boolean) => {
  const entries = sets.map((set, index) => {
    let text: string;
    if (plannedWorkout) {
      text = `planned ${plannedSetLine(set)}`;
    } else if (!set.completed) {
      text = `${set.skipped ? "SKIPPED" : "NOT COMPLETED"} (planned ${plannedSetLine(set)})`;
    } else {
      const performed = formatPerformedSet(set);
      const planned = plannedSetLine(set);
      const actualMatchesPlan = set.completedAsPlanned || (
        set.actualReps.trim() === set.plannedReps.trim()
        && set.actualWeight === set.plannedWeight
        && (!set.rpe || set.rpe === set.plannedRpe)
        && (!set.rir || set.rir === set.plannedRir)
      );
      text = includePlanned && !actualMatchesPlan ? `actual ${performed}; planned ${planned}` : performed;
    }
    if (set.notes) text += `; note: ${set.notes}`;
    return { index: index + 1, text, groupable: !set.notes };
  });
  const lines: string[] = [];
  for (let index = 0; index < entries.length;) {
    let end = index;
    while (entries[index].groupable && entries[end + 1]?.groupable && entries[end + 1].text === entries[index].text) end += 1;
    const label = end > index ? `Sets ${entries[index].index}–${entries[end].index}` : `Set ${entries[index].index}`;
    lines.push(`- ${label}: ${entries[index].text}`);
    index = end + 1;
  }
  return lines;
};

export const workoutToText = (workout: WorkoutSession, includePlanned = true) => {
  const lines = [`${workout.date} — ${workout.name}`];
  if (workout.status === "completed" && !hasTrainingEvidence(workout)) lines.push("Saved session · no completed working training evidence recorded (excluded from training-day counts).");
  if (workout.hyrox) return [...lines, ...hyroxExport(workout, true), ...(workout.notes ? [`Your notes: ${workout.notes}`] : [])].join("\n");
  const exerciseById = new Map(workout.exercises.map((item) => [item.id, item]));
  const activityById = new Map(workout.cardio.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const order = [...(workout.blockOrder ?? [])];
  workout.exercises.forEach((item) => { if (!order.some((block) => block.id === item.id)) order.push({ type: "exercise", id: item.id }); });
  workout.cardio.forEach((item) => { if (!order.some((block) => block.id === item.id)) order.push({ type: "activity", id: item.id }); });
  order.forEach((block) => {
    if (seen.has(block.id)) return;
    seen.add(block.id);
    if (block.type === "exercise") {
      const exercise = exerciseById.get(block.id);
      if (!exercise) return;
      lines.push(`\n${exercise.name}${exercise.substitutedFor ? ` (substituted for ${exercise.substitutedFor})` : ""}:`);
      lines.push(...compactSetLines(exercise.sets, includePlanned, workout.status === "planned"));
      if (exercise.notes) lines.push(`  Your notes: ${exercise.notes}`);
      return;
    }
    const activity = activityById.get(block.id);
    if (!activity) return;
    lines.push(`\n${activity.name}:`);
    if (activity.completed && activity.efforts?.length) lines.push(`- Efforts: ${activity.efforts.map((effort) => effort.completed ? [effort.actualDistanceM !== null ? `${effort.actualDistanceM} m` : "", effort.actualLoad !== null ? `${effort.actualLoad} ${activity.effortLoadUnit ?? "lb"}` : "", effort.actualDurationSec !== null ? `${effort.actualDurationSec} sec` : ""].filter(Boolean).join(" · ") || "done" : "not completed").join("; ")}`);
    if (!activity.completed && activity.efforts?.length) {
      lines.push(...activity.efforts.map((effort, index) => `- Effort ${index + 1}: ${effort.completed ? [effort.actualDistanceM !== null ? `${effort.actualDistanceM} m` : "", effort.actualLoad !== null ? `${effort.actualLoad} ${activity.effortLoadUnit ?? "lb"}` : "", effort.actualDurationSec !== null ? `${effort.actualDurationSec} sec` : ""].filter(Boolean).join(" · ") || "completed; measures unrecorded" : "NOT COMPLETED"}`));
    }
    if (!activity.completed) {
      const planned = [
        activity.plannedDurationMin !== null ? `${activity.plannedDurationMin} min` : "",
        activity.plannedDistanceKm !== null ? `${activity.plannedDistanceKm} km` : "",
        activity.intensity,
      ].filter(Boolean).join(" · ");
      lines.push(`- ${workout.status === "planned" ? "PLANNED" : "NOT COMPLETED"}${planned ? `: ${planned}` : ""}`);
      if (activity.mobilityMoves?.length) lines.push(`- Movements: ${activity.mobilityMoves.map((move) => `${move.name}${move.prescription ? ` ${move.prescription}` : ""}`).join("; ")}`);
      if (activity.efforts?.length) lines.push(`- Prescribed efforts: ${activity.efforts.map((effort) => [effort.plannedDistanceM !== null ? `${effort.plannedDistanceM} m` : "", effort.plannedLoad !== null ? `${effort.plannedLoad} ${activity.effortLoadUnit ?? "lb"}` : "", effort.plannedDurationSec !== null ? `${effort.plannedDurationSec} sec` : ""].filter(Boolean).join(" · ")).join("; ")}`);
    } else {
      const duration = performedDuration(activity);
      const distance = performedDistance(activity);
      if (activity.completedAsPlanned) lines.push("- Completed as prescribed");
      if (duration !== null) lines.push(`- Duration: ${duration} min`);
      if (distance !== null) lines.push(`- Distance: ${distance} km`);
      if (activity.intensity) lines.push(`- Target intensity (not reported effort): ${activity.intensity}`);
      if (activity.pace) lines.push(`- Pace: ${activity.pace}`);
      if (activity.averageHr !== null) lines.push(`- Average HR: ${activity.averageHr} bpm`);
      if (activity.elevationM !== null) lines.push(`- Elevation: ${activity.elevationM} m`);
      if (activity.activityType === "ruck" && activity.ruckLoad !== null) lines.push(`- Ruck load: ${activity.ruckLoad} ${activity.ruckLoadUnit}`);
      if (activity.mobilityMoves?.length) lines.push(`- Movements: ${activity.mobilityMoves.map((move) => `${move.name}${move.prescription ? ` ${move.prescription}` : ""}`).join("; ")}`);
      else if (activity.intervals) lines.push(`- Intervals: ${activity.intervals}`);
      if (activity.effort) lines.push(`- Effort: ${activity.effort}/10`);
      if (activity.notes) lines.push(`- Your notes: ${activity.notes}`);
    }
  });
  if (workout.sessionRpe) lines.push(`\nSession effort: ${workout.sessionRpe}/10`);
  if (workout.notes) lines.push(`Session notes: ${workout.notes}`);
  return lines.join("\n");
};

export type QuickTrainingRange = "last" | "today" | "two-days";

/** A factual chat update without profile, goals, schedule, or a new workout request. */
export const buildQuickTrainingExtract = (
  state: TrainingState,
  range: QuickTrainingRange,
  today = localDate(),
) => {
  const completed = state.workouts
    .filter((workout) => workout.status === "completed" && workout.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.completedAt ?? a.createdAt).localeCompare(b.completedAt ?? b.createdAt));
  const workouts = range === "last"
    ? completed.slice(-1)
    : completed.filter((workout) => workout.date >= (range === "today" ? today : localDateDaysEarlier(1, today)));
  const heading = range === "last"
    ? "MOST RECENT COMPLETED WORKOUT"
    : range === "today"
      ? `COMPLETED WORKOUTS — ${today}`
      : `COMPLETED WORKOUTS — ${localDateDaysEarlier(1, today)} TO ${today}`;
  return `${heading}\n${workouts.length ? workouts.map((workout) => workoutToText(workout, false)).join("\n\n") : "No completed workouts recorded in this period."}`;
};

const personalRecords = (state: TrainingState) =>
  [...strengthRecords(state, state.settings.defaultUnit).entries()]
    .sort((a, b) => b[1].e1rm - a[1].e1rm)
    .slice(0, 8)
    .map(([name, record]) => `- ${name}: ${record.display} (estimated 1RM ${Math.round(record.e1rm)} ${state.settings.defaultUnit})`);

export const buildCoachPrompt = (
  state: TrainingState,
  options: CoachOptions,
  today = localDate(),
) => {
  const cutoff = new Date(`${today}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - Math.max(0, options.days - 1));
  const cutoffDate = options.since ?? localDate(cutoff);
  const sinceAt = options.sinceAt ?? null;
  const completed = state.workouts
    .filter((workout) => workout.status === "completed" && workout.date <= localDate())
    .sort((a, b) => a.date.localeCompare(b.date) || (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  const workouts = options.since
    ? completed.filter((workout) => workout.date >= cutoffDate || Boolean(sinceAt && (workout.updatedAt ?? workout.completedAt ?? workout.createdAt) >= sinceAt))
    : options.days === 0
    ? completed.slice(-1)
    : completed.filter((workout) => workout.date >= cutoffDate);
  const skipped = state.workouts
    .filter(
      (workout) =>
        (Boolean(options.since) || options.days !== 0) && workout.status === "skipped" && workout.date <= today && (workout.date >= cutoffDate || Boolean(sinceAt && (workout.updatedAt ?? workout.skippedAt ?? workout.createdAt) >= sinceAt)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const planned = state.workouts
    .filter((workout) => workout.status === "planned")
    .sort((a, b) => a.date.localeCompare(b.date));
  const active = state.activeWorkoutId
    ? state.workouts.find((workout) => workout.id === state.activeWorkoutId && workout.status === "active")
    : undefined;

  const records = personalRecords(state);
  const bodyweight = [...state.bodyweightEntries].filter((entry) => entry.date <= localDate()).sort((a, b) => b.date.localeCompare(a.date))[0];
  const waist = [...(state.waistEntries ?? [])].filter(e=>!e.deletedAt && e.date<=localDate()).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const schedule = [
    ...state.scheduleContext.events.filter((entry) => !entry.deletedAt && entry.date >= localDate()).sort((a, b) => a.date.localeCompare(b.date)).map((entry) => `- ${entry.date}: ${entry.label}`),
    ...state.scheduleContext.phases.filter((phase) => !phase.deletedAt && phase.end >= localDate()).sort((a, b) => a.start.localeCompare(b.start)).map((phase) => `- ${phase.start} to ${phase.end}: ${phase.label}`),
  ];
  const recentTestCutoff = new Date(`${today}T12:00:00Z`);
  recentTestCutoff.setUTCDate(recentTestCutoff.getUTCDate() - 28);
  const nearTestHorizon = new Date(`${today}T12:00:00Z`);
  nearTestHorizon.setUTCDate(nearTestHorizon.getUTCDate() + 14);
  const benchmarks = (state.benchmarks ?? []).filter((item) => !item.deletedAt).flatMap((item) => {
    const due = benchmarkDueDate(item);
    if (!(due && due <= nearTestHorizon.toISOString().slice(0, 10)) && !(item.testedOn && item.testedOn >= recentTestCutoff.toISOString().slice(0, 10) && item.testedOn <= today)) return [];
    return [`- ${item.name}${item.protocol ? ` (${item.protocol})` : ""}: ${item.result ? `${item.result} on ${item.testedOn}` : "no result"}${due ? `; re-test ${due}` : ""}`];
  });
  const opening = options.mode === "new"
    ? `This is a new coaching chat. Use the full athlete context below as durable background, then use the recent training log as the authoritative update.

${state.coachProfile.trim() || DEFAULT_COACH_PROFILE}`
    : "You are continuing to help me plan my training. Use the recent history below as the latest update instead of assuming what I completed. Preserve the long-term goals and context already established in this chat.";

  return `${opening}

CURRENT DATE
${today}

GOALS — RANKED IN PRIORITY ORDER
${state.goals.map((goal, index) => `${index + 1}. ${goal}`).join("\n") || "- No goals recorded"}

RECORDED STRENGTH BENCHMARKS — ALL TIME
${records.length ? records.join("\n") : "- No recorded strength PRs yet"}

LATEST BODYWEIGHT
${bodyweight ? `- ${bodyweight.date}: ${bodyweight.weight} ${bodyweight.unit} (use this dated measurement over older profile estimates)` : "- Not logged"}

${waist ? `LATEST WAIST\n- ${waist.date}: ${Number(waist.cm.toFixed(2))} cm\n\n` : ""}SAVED UPCOMING SCHEDULE — PLANNED, NOT COMPLETED
${schedule.length ? schedule.join("\n") : "- None saved"}

${benchmarks.length ? `PINNED BENCHMARKS — RECENT OR DUE (not prescribed training)\n${benchmarks.join("\n")}\n` : ""}

${options.since ? `TRAINING — SINCE ${options.since}` : options.days === 0 ? "MOST RECENT COMPLETED SESSION" : `TRAINING — LAST ${options.days} DAY${options.days === 1 ? "" : "S"}`}
${workouts.length ? workouts.map((workout) => workoutToText(workout)).join("\n\n") : "No completed workouts recorded in this period."}

${options.since ? `SKIPPED OR CHANGED PLANS — SINCE ${options.since}` : options.days === 0 ? "SKIPPED OR CHANGED PLANS" : `SKIPPED OR CHANGED PLANS — LAST ${options.days} DAY${options.days === 1 ? "" : "S"}`}
${skipped.length ? skipped.map((workout) => `- ${workout.date} — ${workout.name}: ${workout.skipReason || "Reason not recorded"}`).join("\n") : "- None recorded"}

SAVED PLANS — NOT YET COMPLETED
${planned.length ? planned.map((workout) => workoutToText(workout)).join("\n\n") : "- None saved"}

ACTIVE SESSION — IN PROGRESS, NOT YET COMPLETED
${active ? workoutToText(active) : "- None"}

TODAY
- Energy: ${options.energy ? `${options.energy}/10` : "Not provided"}
- Sleep: ${options.sleep || "Not provided"}
- Soreness: ${options.soreness || "Not provided"}
- Time available: ${options.timeAvailable || "Not provided"}
- Equipment: ${options.equipment || "Not provided"}
- Restrictions: ${options.restrictions || "None provided"}
- Other PT / schedule in the next 48 hours: ${options.schedule || "Not provided"}

REQUEST
${options.request || "Recommend my next workout based on my recent training, recovery, and goals."}

${options.emphasis?.trim() ? `ATHLETE NOTE — FOR THIS BRIEF ONLY\n${options.emphasis.trim()}\nTreat this as current context, not a permanent profile change. Keep the FITLOG output rules below.\n` : ""}

Briefly explain the reasoning, then provide exactly one importable workout using this format:

${options.mode === "new" ? FITLOG_INSTRUCTIONS : FITLOG_REMINDER}`;
};
