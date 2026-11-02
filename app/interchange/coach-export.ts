import { performedDuration, performedDistance, formatMeasure, hasCompletedActivityWork, hasTrainingEvidence } from "../domain/completion";
import { formatSegmentMeasure, hasSegmentPrescription, segmentCountLabel, segmentGroupProgress, segmentMeasure, segmentMismatch } from "../domain/activity-segments";
import { hyroxExport } from "../domain/hyrox";
import { FITLOG_V3_INSTRUCTIONS, FITLOG_V3_REMINDER } from "./fitlog";
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

/** The format paragraph of the coach profile. Copying this (Coach view button) is how an existing stored profile picks up the v110 format rules; the app never rewrites a stored profile. */
export const NEW_COACH_PROFILE_PARAGRAPH = `Be direct: recommend the next useful session from recent history and explain your reasoning briefly. When I ask for a workout, return exactly one importable FITLOG block and nothing else. For mixed run/walk sessions, include an explicit TYPE line, normally TYPE|run. Use INTERVALS|6 x (3 min run / 1 min walk) for SUMMARY-mode runs; use MODE|segments with REPEAT for segmented runs. Write mobility as MOVE|name|prescription, with prescriptions such as N x .../side or N x ... sec. Prescribe circuits as REPEAT rounds with labeled stations and kind rest for rests, and swim as REPEAT sets with distances in m. Yoga, grappling, soccer, and water polo are post-session only: MODE|summary with DURATION and NOTES, never SEGMENT lines.`;

export const DEFAULT_COACH_PROFILE = `Act as my long-term strength, physique, running, and conditioning coach. Each time I check in, recommend one next session — there is no fixed weekly plan; you program day by day from what I actually did.

Base everything on the completed training history, goals, bodyweight entries, and schedule in each brief. Never assume a planned workout was completed. Treat skipped sessions as skipped, and keep planned and completed work clearly separate.

Account for accumulated load, recovery, sleep, injuries, travel, and anything else in the brief. Keep training challenging and productive — no junk volume.

${NEW_COACH_PROFILE_PARAGRAPH}`;
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
    if (activity.skipped) {
      lines.push("- SKIPPED");
      return;
    }
    const activityDone = activity.segments?.length ? hasCompletedActivityWork(activity) : activity.completed;
    if (activity.segments?.length) {
      if (activity.completedAsPlanned && hasSegmentPrescription(activity)) lines.push("- Completed as prescribed");
      lines.push(`- Segments: ${segmentCountLabel(activity.segments)}`);
      const duration = segmentMeasure(activity, "duration");
      const distance = segmentMeasure(activity, "distance");
      lines.push(`- Total duration: ${formatSegmentMeasure(duration, "duration")}`);
      if (!duration?.fullyRecorded && (activity.actualDurationMin !== null || activity.plannedDurationMin !== null)) {
        const sessionMin = activity.actualDurationMin ?? activity.plannedDurationMin!;
        lines.push(`- Session duration: ${formatMeasure(sessionMin)} min${activity.actualDurationMin === null ? " as prescribed" : ""}`);
      }
      lines.push(`- Total distance: ${formatSegmentMeasure(distance, "distance")}`);
      if (activity.activityType === "run") {
        lines.push(`- Running only: ${formatSegmentMeasure(segmentMeasure(activity, "duration", "run"), "duration")} · ${formatSegmentMeasure(segmentMeasure(activity, "distance", "run"), "distance")}`);
        lines.push(`- Walking only: ${formatSegmentMeasure(segmentMeasure(activity, "duration", "walk"), "duration")} · ${formatSegmentMeasure(segmentMeasure(activity, "distance", "walk"), "distance")}`);
        if (activity.effort) lines.push(`- RPE: ${activity.effort}/10`);
      }
      const segmentLine = (segment: NonNullable<typeof activity.segments>[number]) => {
        const values = segment.status === "completed"
          ? [segment.plannedDurationSec != null ? `${formatMeasure(segment.plannedDurationSec / 60)} min as prescribed` : "", segment.kind !== "rest" && segment.plannedDistanceM != null ? `${formatMeasure(segment.plannedDistanceM / 1000)} km as prescribed` : ""]
          : segment.status === "modified" ? [segment.actualDurationSec != null ? `${formatMeasure(segment.actualDurationSec / 60)} min measured` : "", segment.kind !== "rest" && segment.actualDistanceM != null ? `${formatMeasure(segment.actualDistanceM / 1000)} km measured` : ""]
            : [];
        return `- ${segment.label?.trim() ? `${segment.label.trim()} · ` : ""}${segment.kind.toUpperCase()} · ${segment.status.toUpperCase()}${values.filter(Boolean).length ? ` · ${values.filter(Boolean).join(" · ")}` : ""}`;
      };
      const segmentGroups = new Map<string, NonNullable<typeof activity.segments>>();
      for (const segment of activity.segments) {
        const key = segment.groupId ?? segment.id;
        segmentGroups.set(key, [...(segmentGroups.get(key) ?? []), segment]);
      }
      for (const parts of segmentGroups.values()) {
        if (parts[0]?.groupId) {
          const progress = segmentGroupProgress(parts);
          const groupWord = activity.activityType === "circuit" ? "rounds" : activity.activityType === "swim" ? "sets" : "repeats";
          lines.push(`- Repeat group · ${progress.roundsDone} of ${progress.roundsTotal} ${groupWord} done · ${progress.done} of ${progress.total} intervals done`);
        }
        for (const segment of parts) lines.push(segmentLine(segment));
      }
      const mismatch = segmentMismatch(activity);
      if (mismatch) lines.push(`- Warning: ${mismatch.message}`);
      if (activityDone) {
        if (activity.intensity) lines.push(`- Target intensity (not reported effort): ${activity.intensity}`);
        if (activity.pace) lines.push(`- Pace: ${activity.pace}`);
        if (activity.averageHr !== null) lines.push(`- Average HR: ${activity.averageHr} bpm`);
        if (activity.elevationM !== null) lines.push(`- Elevation: ${activity.elevationM} m`);
        if (activity.activityType === "ruck" && activity.ruckLoad !== null) lines.push(`- Ruck load: ${activity.ruckLoad} ${activity.ruckLoadUnit}`);
        if (activity.mobilityMoves?.length) lines.push(`- Movements: ${activity.mobilityMoves.map((move) => `${move.name}${move.prescription ? ` ${move.prescription}` : ""}`).join("; ")}`);
        if (activity.intervals) lines.push(`- Intervals: ${activity.intervals}`);
        if (activity.activityType !== "run" && activity.effort) lines.push(`- RPE: ${activity.effort}/10`);
        if (activity.notes) lines.push(`- Notes: ${activity.notes}`);
      }
    }
    if (activity.completed && activity.efforts?.length) lines.push(`- Efforts: ${activity.efforts.map((effort) => effort.completed ? [effort.actualDistanceM !== null ? `${effort.actualDistanceM} m` : "", effort.actualLoad !== null ? `${effort.actualLoad} ${activity.effortLoadUnit ?? "lb"}` : "", effort.actualDurationSec !== null ? `${effort.actualDurationSec} sec` : ""].filter(Boolean).join(" · ") || "done" : "not completed").join("; ")}`);
    if (!activity.completed && !activity.segments?.length && activity.efforts?.length) {
      lines.push(...activity.efforts.map((effort, index) => `- Effort ${index + 1}: ${effort.completed ? [effort.actualDistanceM !== null ? `${effort.actualDistanceM} m` : "", effort.actualLoad !== null ? `${effort.actualLoad} ${activity.effortLoadUnit ?? "lb"}` : "", effort.actualDurationSec !== null ? `${effort.actualDurationSec} sec` : ""].filter(Boolean).join(" · ") || "completed; measures unrecorded" : "NOT COMPLETED"}`));
    }
    if (!activityDone) {
      const planned = [
        activity.plannedDurationMin !== null ? `${formatMeasure(activity.plannedDurationMin)} min` : "",
        activity.plannedDistanceKm !== null ? `${formatMeasure(activity.plannedDistanceKm)} km` : "",
        activity.intensity,
      ].filter(Boolean).join(" · ");
      lines.push(`- ${workout.status === "planned" ? "PLANNED" : "NOT COMPLETED"}${planned ? `: ${planned}` : ""}`);
      if (activity.mobilityMoves?.length) lines.push(`- Movements: ${activity.mobilityMoves.map((move) => `${move.name}${move.prescription ? ` ${move.prescription}` : ""}`).join("; ")}`);
      if (activity.efforts?.length) lines.push(`- Prescribed efforts: ${activity.efforts.map((effort) => [effort.plannedDistanceM !== null ? `${effort.plannedDistanceM} m` : "", effort.plannedLoad !== null ? `${effort.plannedLoad} ${activity.effortLoadUnit ?? "lb"}` : "", effort.plannedDurationSec !== null ? `${effort.plannedDurationSec} sec` : ""].filter(Boolean).join(" · ")).join("; ")}`);
    } else if (!activity.segments?.length) {
      const duration = performedDuration(activity);
      const distance = performedDistance(activity);
      const hasPrescription = activity.plannedDurationMin !== null || activity.plannedDistanceKm !== null || Boolean(activity.intervals || activity.mobilityMoves?.some(move => move.prescription) || activity.efforts?.some(effort => effort.plannedDistanceM !== null || effort.plannedDurationSec !== null || effort.plannedLoad !== null));
      if (activity.completedAsPlanned && hasPrescription) lines.push("- Completed as prescribed");
      if ((activity.roundsDone ?? 0) > 0) lines.push(`- Rounds completed: ${activity.roundsDone}`);
      if (duration !== null) lines.push(`- Duration: ${formatMeasure(duration)} min`);
      if (distance !== null) lines.push(`- Distance: ${formatMeasure(distance)} km`);
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

export type QuickTrainingRange = "last" | "today" | "two-days" | "seven-days" | "fourteen-days" | "thirty-days" | "sixty-days";

/** A factual chat update without profile, goals, schedule, or a new workout request. */
export const buildQuickTrainingExtract = (
  state: TrainingState,
  range: QuickTrainingRange,
  today = localDate(),
) => {
  const completed = state.workouts
    .filter((workout) => workout.status === "completed" && workout.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.completedAt ?? a.createdAt).localeCompare(b.completedAt ?? b.createdAt));
  const daysAgo = range === "today" ? 0
    : range === "two-days" ? 1
    : range === "seven-days" ? 6
    : range === "fourteen-days" ? 13
    : range === "thirty-days" ? 29
    : range === "sixty-days" ? 59
    : null;
  const workouts = range === "last"
    ? completed.slice(-1)
    : completed.filter((workout) => workout.date >= (daysAgo === 0 ? today : localDateDaysEarlier(daysAgo!, today)));
  const heading = range === "last"
    ? "MOST RECENT COMPLETED WORKOUT"
    : range === "today"
      ? `COMPLETED WORKOUTS — ${today}`
      : `COMPLETED WORKOUTS — ${localDateDaysEarlier(daysAgo!, today)} TO ${today}`;
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

${options.mode === "new" ? FITLOG_V3_INSTRUCTIONS : FITLOG_V3_REMINDER}`;
};
