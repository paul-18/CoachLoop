import type { CardioEntry, GoalTarget, GoalTargetKind, TrainingSet, TrainingState } from "./training-types";
import { localDate, uid } from "./training-types";
import { canonicalExerciseName, convertWeight, estimatedOneRepMax, isPrimaryStrengthExercise, strengthRecords } from "./training-metrics";
import { parseExactReps, performedDistance, performedDuration, performedReps, performedWeight } from "./completion";

export type SetupFocus = "strength" | "run" | "both" | "log";

export type GoalPreset = {
  id: string;
  label: string;
  text: string;
  focus: Array<Exclude<SetupFocus, "log" | "both">>;
  kind: GoalTargetKind;
  exercise?: string;
  /** Target weight in lb for e1rm goals. */
  targetWeight?: number;
  targetReps?: number;
  distanceKm?: number;
  maxMinutes?: number;
  perWeek?: number;
  weeks?: number;
  totalWorkouts?: number;
};

/** Concrete drafts. Nothing is saved until the user taps a preset or Continue. */
export const GOAL_PRESETS: GoalPreset[] = [
  { id: "bench-225", label: "Bench 225", text: "Bench press 225 lb × 1", focus: ["strength"], kind: "e1rm", exercise: "Barbell Bench Press", targetWeight: 225, targetReps: 1 },
  { id: "squat-315", label: "Squat 315", text: "Back squat 315 lb × 1", focus: ["strength"], kind: "e1rm", exercise: "Barbell Squat", targetWeight: 315, targetReps: 1 },
  { id: "deadlift-405", label: "Deadlift 405", text: "Deadlift 405 lb × 1", focus: ["strength"], kind: "e1rm", exercise: "Barbell Deadlift", targetWeight: 405, targetReps: 1 },
  { id: "press-135", label: "Press 135", text: "Overhead press 135 lb × 1", focus: ["strength"], kind: "e1rm", exercise: "Overhead Press", targetWeight: 135, targetReps: 1 },
  { id: "pullups-10", label: "10 pull-ups", text: "10 strict pull-ups", focus: ["strength"], kind: "reps", exercise: "Pull-Up", targetReps: 10 },
  { id: "pushups-50", label: "50 push-ups", text: "50 push-ups unbroken", focus: ["strength"], kind: "reps", exercise: "Push-Up", targetReps: 50 },
  { id: "first-5k", label: "First 5K", text: "Finish a 5K", focus: ["run"], kind: "distance", distanceKm: 5 },
  { id: "five-k-30", label: "5K under 30", text: "5K under 30:00", focus: ["run"], kind: "race", distanceKm: 5, maxMinutes: 30 },
  { id: "train-3x8", label: "3×/week × 8", text: "Train 3× per week for 8 weeks", focus: ["strength", "run"], kind: "consistency", perWeek: 3, weeks: 8 },
  { id: "log-50", label: "50 workouts", text: "Log 50 workouts", focus: ["strength", "run"], kind: "consistency", totalWorkouts: 50 },
];

export const presetById = (id: string) => GOAL_PRESETS.find(preset => preset.id === id);

export const presetsForFocus = (focus: SetupFocus) =>
  focus === "log" ? [] : GOAL_PRESETS.filter(preset => focus === "both" || preset.focus.includes(focus));

/** Create a structured, trackable goal from a preset. Tracking binds to these
 * fields — editing the label later never breaks measurement. */
export const makeGoalTarget = (preset: GoalPreset): GoalTarget => ({
  id: uid("goal"),
  presetId: preset.id,
  label: preset.label,
  kind: preset.kind,
  exercise: preset.exercise,
  targetWeight: preset.targetWeight,
  targetReps: preset.targetReps,
  distanceKm: preset.distanceKm,
  maxMinutes: preset.maxMinutes,
  perWeek: preset.perWeek,
  weeks: preset.weeks,
  totalWorkouts: preset.totalWorkouts,
  createdAt: new Date().toISOString(),
  achievedAt: null,
});

export type GoalProgress = {
  label: string;
  ratio: number;
  done: boolean;
  detail: string;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const emptyProgress = (label: string, detail: string): GoalProgress => ({ label, ratio: 0, done: false, detail });

const bestEligibleE1rm = (state: TrainingState, exercise: string) => {
  const wanted = canonicalExerciseName(exercise, state.exerciseAliases);
  const record = strengthRecords(state, "lb").get(wanted);
  return record ? { e1rm: record.e1rm, display: record.display } : null;
};

/** Best single-set reps for an exercise across completed, non-warmup sets. */
const bestSetReps = (state: TrainingState, exercise: string): number => {
  const wanted = canonicalExerciseName(exercise, state.exerciseAliases);
  let best = 0;
  for (const workout of state.workouts) {
    for (const block of workout.exercises) {
      if (canonicalExerciseName(block.name, state.exerciseAliases) !== wanted) continue;
      for (const set of block.sets) {
        if (!set.completed || set.warmup || set.skipped) continue;
        const reps = parseExactReps(performedReps(set));
        if (reps !== null && reps > best) best = reps;
      }
    }
  }
  return best;
};

const completedRuns = (state: TrainingState) => state.workouts
  .filter(workout => workout.status === "completed" && workout.date <= localDate())
  .flatMap(workout => workout.cardio)
  .filter(activity => activity.completed && activity.activityType === "run");

const runEvidence = (activity: CardioEntry) => ({
  km: performedDistance(activity),
  minutes: performedDuration(activity),
});

const completedWorkoutDates = (state: TrainingState): string[] => state.workouts
  .filter(workout => workout.status === "completed" && workout.date <= localDate())
  .map(workout => workout.date);

/** Trailing 7-day windows ending today: how many meet the per-week target. */
const weeksMeetingTarget = (state: TrainingState, perWeek: number, weeks: number): number => {
  const dates = completedWorkoutDates(state);
  const today = new Date(`${localDate()}T12:00:00`);
  let met = 0;
  for (let i = 0; i < weeks; i++) {
    const end = new Date(today);
    end.setDate(end.getDate() - 7 * i);
    const start = new Date(today);
    start.setDate(start.getDate() - 7 * (i + 1) + 1);
    const from = localDate(start);
    const to = localDate(end);
    if (dates.filter(date => date >= from && date <= to).length >= perWeek) met++;
  }
  return met;
};

const targetE1rm = (target: GoalTarget): number | null => {
  if (target.kind !== "e1rm" || !target.targetWeight) return null;
  return estimatedOneRepMax(target.targetWeight, target.targetReps ?? 1);
};

/** Progress for a saved, structured goal target. Pure math over logged evidence. */
export const targetProgress = (state: TrainingState, target: GoalTarget): GoalProgress => {
  if (target.kind === "e1rm") {
    if (!target.exercise || !target.targetWeight) return emptyProgress(target.label, "Missing target details.");
    const goal = targetE1rm(target);
    if (goal === null) return emptyProgress(target.label, "Missing target details.");
    const best = bestEligibleE1rm(state, target.exercise);
    if (!best) return { label: target.label, ratio: 0, done: false, detail: "No eligible estimate yet. Warm-ups and high-rep sets are not counted." };
    const ratio = clamp01(best.e1rm / goal);
    const done = best.e1rm >= goal;
    return {
      label: target.label,
      ratio,
      done,
      detail: done
        ? `You already did it. Best estimate ${Math.round(best.e1rm)} lb from ${best.display}.`
        : `Best estimate ${Math.round(best.e1rm)} lb · ${Math.round(ratio * 100)}% of ${Math.round(goal)} lb`,
    };
  }
  if (target.kind === "reps") {
    if (!target.exercise || !target.targetReps) return emptyProgress(target.label, "Missing target details.");
    const best = bestSetReps(state, target.exercise);
    const ratio = clamp01(best / target.targetReps);
    const done = best >= target.targetReps;
    return {
      label: target.label,
      ratio,
      done,
      detail: done
        ? `You already did it. Best set ${best} reps.`
        : best > 0 ? `Best set ${best} of ${target.targetReps} reps.` : "No logged sets yet.",
    };
  }
  const runs = completedRuns(state).map(runEvidence).filter(run => run.km !== null);
  if (target.kind === "distance" && target.distanceKm) {
    const best = runs.reduce((max, run) => Math.max(max, run.km ?? 0), 0);
    const done = best >= target.distanceKm;
    return {
      label: target.label,
      ratio: clamp01(best / target.distanceKm),
      done,
      detail: done ? `You already did it. Longest logged run ${best.toFixed(1)} km.` : best > 0 ? `Longest logged run ${best.toFixed(1)} km of ${target.distanceKm} km.` : "No completed run distance yet.",
    };
  }
  if (target.kind === "race" && target.distanceKm && target.maxMinutes) {
    const eligible = runs.filter(run => (run.km ?? 0) >= target.distanceKm! && run.minutes !== null && run.minutes <= target.maxMinutes!);
    const done = eligible.length > 0;
    const nearest = runs.filter(run => (run.km ?? 0) >= target.distanceKm!).sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity))[0];
    return {
      label: target.label,
      ratio: done ? 1 : nearest?.minutes ? clamp01(target.maxMinutes / nearest.minutes) : clamp01(runs.reduce((max, run) => Math.max(max, run.km ?? 0), 0) / target.distanceKm),
      done,
      detail: done
        ? `You already did it. A logged ${target.distanceKm}K is at or under ${target.maxMinutes}:00.`
        : nearest?.minutes ? `Best logged ${target.distanceKm}K ${nearest.minutes} min. Target is ${target.maxMinutes}:00.` : `No completed ${target.distanceKm}K with a time yet.`,
    };
  }
  if (target.kind === "consistency") {
    if (target.perWeek && target.weeks) {
      const met = weeksMeetingTarget(state, target.perWeek, target.weeks);
      const done = met >= target.weeks;
      return {
        label: target.label,
        ratio: clamp01(met / target.weeks),
        done,
        detail: done ? `You already did it. ${met} of ${target.weeks} weeks at ${target.perWeek}×/week.` : `${met} of ${target.weeks} weeks at ${target.perWeek}×/week so far.`,
      };
    }
    if (target.totalWorkouts) {
      const count = completedWorkoutDates(state).length;
      const done = count >= target.totalWorkouts;
      return {
        label: target.label,
        ratio: clamp01(count / target.totalWorkouts),
        done,
        detail: done ? `You already did it. ${count} workouts logged.` : `${count} of ${target.totalWorkouts} workouts logged.`,
      };
    }
    return emptyProgress(target.label, "Missing target details.");
  }
  return emptyProgress(target.label, "Missing target details.");
};

/** Progress for a preset draft (not yet saved) — same math, from preset fields. */
export const presetProgress = (state: TrainingState, preset: GoalPreset): GoalProgress =>
  targetProgress(state, makeGoalTarget(preset));

export const checkTargetAchieved = (state: TrainingState, target: GoalTarget): boolean =>
  targetProgress(state, target).done;

/** Stamp retroactive achievement at creation: if the log already contains the
 * target, it completes the moment it is created. */
export const stampNewTarget = (state: TrainingState, target: GoalTarget): GoalTarget =>
  checkTargetAchieved(state, target) ? { ...target, achievedAt: new Date().toISOString() } : target;

/** Merge freshly picked targets into existing ones, skipping preset duplicates. */
export const mergeGoalTargets = (current: GoalTarget[] | undefined, fresh: GoalTarget[]): GoalTarget[] => {
  const have = new Set((current ?? []).map(target => target.presetId));
  return [...(current ?? []), ...fresh.filter(target => !have.has(target.presetId))];
};

export const oneThingToday = (state: TrainingState) => {
  for (const target of state.goalTargets ?? []) {
    const progress = targetProgress(state, target);
    if (progress.done) continue;
    return { title: "One thing today", body: progress.detail, label: target.label };
  }
  return null;
};

export const personalRecordMessage = (state: TrainingState, exerciseName: string, set: TrainingSet) => {
  const name = canonicalExerciseName(exerciseName, state.exerciseAliases);
  if (set.warmup) return null;
  const reps = parseExactReps(performedReps(set));
  if (reps === null || reps <= 0) return null;
  const targets = state.goalTargets ?? [];
  if (isPrimaryStrengthExercise(name) && set.loadType === "weighted" && set.weightMode === "total") {
    const weight = performedWeight(set);
    if (weight === null || weight <= 0) return null;
    const e1rm = estimatedOneRepMax(convertWeight(weight, set.unit, "lb"), reps);
    if (e1rm === null) return null;
    const previous = strengthRecords(state, "lb").get(name)?.e1rm ?? 0;
    if (e1rm <= previous) return null;
    const record = `New estimated record: ${name}, ${weight} ${set.unit} × ${reps}`;
    const reached = targets.find(target => {
      if (target.achievedAt || target.kind !== "e1rm" || !target.exercise || !target.targetWeight) return false;
      if (canonicalExerciseName(target.exercise, state.exerciseAliases) !== name) return false;
      const goal = estimatedOneRepMax(target.targetWeight, target.targetReps ?? 1);
      return goal !== null && e1rm >= goal;
    });
    return reached ? `${record}. That reaches ${reached.label}.` : record;
  }
  const reachedReps = targets.find(target => {
    if (target.achievedAt || target.kind !== "reps" || !target.exercise || !target.targetReps) return false;
    return canonicalExerciseName(target.exercise, state.exerciseAliases) === name && reps >= target.targetReps;
  });
  if (reachedReps) return `That reaches ${reachedReps.label}: ${reps} ${name}.`;
  return null;
};

const fitlog = (name: string, body: string) => `[FITLOG:1]
WORKOUT|${name} — review before saving|${localDate()}
${body}
NOTES|Starter template only. Set loads and effort that fit you. Nothing is saved until you confirm the import.
[/FITLOG]`;

export const WORKOUT_TEMPLATES = [
  {
    id: "push",
    label: "Push",
    detail: "Bench, press, accessories",
    fitlog: () => fitlog("Push starter", `EXERCISE|Barbell Bench Press
SET|5||RPE 7
SET|5||RPE 7
SET|5||RPE 8
REST|150
EXERCISE|Overhead Press
SET|6||RPE 7
SET|6||RPE 8
REST|120
EXERCISE|Triceps extension
SET|10||RPE 7
SET|10||RPE 8
REST|60`),
  },
  {
    id: "pull",
    label: "Pull",
    detail: "Row, pull-up, hinge",
    fitlog: () => fitlog("Pull starter", `EXERCISE|Barbell Row
SET|6||RPE 7
SET|6||RPE 8
REST|120
EXERCISE|Pull-Up
SET|5|Bodyweight|RPE 7
SET|5|Bodyweight|RPE 8
REST|120
NOTES|Enter actual pull-up reps. Do not double them.
EXERCISE|Romanian Deadlift
SET|8||RPE 7
SET|8||RPE 8
REST|90`),
  },
  {
    id: "legs",
    label: "Legs",
    detail: "Squat and posterior chain",
    fitlog: () => fitlog("Legs starter", `EXERCISE|Barbell Squat
SET|5||RPE 7
SET|5||RPE 7
SET|5||RPE 8
REST|180
EXERCISE|Romanian Deadlift
SET|8||RPE 7
SET|8||RPE 8
REST|120
EXERCISE|Walking Lunge
SET|8||RPE 7
REST|60
NOTES|Enter lunge reps per side.`),
  },
  {
    id: "full",
    label: "Full-body starter",
    detail: "One short mixed session",
    fitlog: () => fitlog("Full-body starter", `EXERCISE|Barbell Squat
SET|5||RPE 6
SET|5||RPE 7
REST|150
EXERCISE|Barbell Bench Press
SET|5||RPE 6
SET|5||RPE 7
REST|150
EXERCISE|Barbell Row
SET|6||RPE 7
REST|120
CARDIO|Easy walk
TYPE|walk
DURATION|10
INTENSITY|easy`),
  },
  {
    id: "fivek",
    label: "5K prep",
    detail: "Easy run plus a short strength primer",
    fitlog: () => fitlog("5K prep", `CARDIO|Easy 5K prep
TYPE|run
DURATION|25
DISTANCE|5
INTENSITY|conversational
NOTES|Whole-session distance and time. Adjust both before saving.
EXERCISE|Bodyweight squat
SET|8|Bodyweight|RPE 5
REST|45`),
  },
] as const;

export const templateById = (id: string) => WORKOUT_TEMPLATES.find(template => template.id === id);
