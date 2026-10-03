import { canonicalExerciseName, convertWeight, estimatedOneRepMax, exerciseIdentity, formatLoad, isPrimaryStrengthExercise, parseExactReps, performedReps, performedWeight } from "./training-metrics";
import { localDate, type TrainingState } from "./training-types";

export type TrendMetric = "e1rm" | "load" | "reps";
export type TrendPoint = { date: string; value: number; setLabel: string; effort: string };
export type TrendSeries = { key: string; name: string; metric: TrendMetric; points: TrendPoint[] };

/** A recent-capability view so an easy session does not look like lost strength. */
export const RECENT_STRENGTH_WINDOW_DAYS = 42;

export const localDateDaysEarlier = (days: number, today = localDate()) => {
  const value = new Date(`${today}T12:00:00`);
  value.setDate(value.getDate() - Math.max(0, days));
  return localDate(value);
};

const dateDaysEarlier = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - days);
  return localDate(value);
};

const recentBestPoints = (points: TrendPoint[]) => {
  const deque: TrendPoint[] = []; let head = 0;
  return points.map(point => {
    const start = dateDaysEarlier(point.date, RECENT_STRENGTH_WINDOW_DAYS - 1);
    while (head < deque.length && deque[head].date < start) head++;
    while (deque.length > head && deque.at(-1)!.value < point.value) deque.pop();
    deque.push(point);
    const best = deque[head];
    return best === point ? point : { ...point, value: best.value, setLabel: `Recent best: ${best.setLabel} (${best.date})`, effort: best.effort };
  });
};

export function dateInWindow(date: string, days: number, today = localDate()) {
  return date >= localDateDaysEarlier(Math.max(0, days - 1), today) && date <= today;
}

/** Every set is classified independently: added load never replaces bodyweight reps. */
export function buildExerciseTrends(state: TrainingState, today = localDate()): TrendSeries[] {
  const series = new Map<string, TrendSeries>();
  const dayIndices = new Map<string, Map<string, number>>();
  const completed = state.workouts.filter((workout) => workout.status === "completed" && workout.date <= today);
  const names = new Map<string, string>();
  completed.forEach((workout) => workout.exercises.forEach((exercise) => {
    const key = exerciseIdentity(exercise.name, state.exerciseAliases);
    if (!names.has(key)) names.set(key, canonicalExerciseName(exercise.name, state.exerciseAliases));
  }));
  completed.forEach((workout) => workout.exercises.forEach((exercise) => {
    const name = names.get(exerciseIdentity(exercise.name, state.exerciseAliases))!;
    exercise.sets.forEach((set) => {
      if (!set.completed || set.warmup) return;
      const reps = parseExactReps(performedReps(set));
      if (reps === null) return;
      let metric: TrendMetric;
      let value: number;
      let suffix = "";
      if (set.loadType === "bodyweight") {
        metric = "reps";
        value = reps;
      } else {
        const weight = performedWeight(set);
        if (set.loadType !== "weighted" || weight === null || weight <= 0) return;
        value = convertWeight(weight, set.unit, state.settings.defaultUnit);
        metric = isPrimaryStrengthExercise(name) && set.weightMode === "total" ? "e1rm" : "load";
        if (metric === "e1rm") {
          const estimate = estimatedOneRepMax(value, reps);
          if (estimate === null) return;
          value = estimate;
        }
        suffix = set.weightMode === "added" ? " · added load" : set.weightMode === "per_hand" ? " · per hand" : metric === "load" ? " · total load" : "";
      }
      const seriesName = name + suffix;
      const seriesKey = [exerciseIdentity(exercise.name, state.exerciseAliases), metric, set.loadType, set.weightMode].join("|");
      const current = series.get(seriesKey) ?? { key: seriesKey, name: seriesName, metric, points: [] };
      const label = set.loadType === "bodyweight" ? `${reps} reps` : `${formatLoad(set.loadType, performedWeight(set), set.unit, set.weightMode)} × ${reps}`;
      const point = { date: workout.date, value, setLabel: label, effort: set.rpe ? `RPE ${set.rpe}` : set.rir ? `RIR ${set.rir}` : "" };
      const days = dayIndices.get(seriesKey) ?? new Map<string, number>();
      dayIndices.set(seriesKey, days);
      const existing = days.get(workout.date);
      if (existing === undefined) { days.set(workout.date, current.points.length); current.points.push(point); }
      else if (point.value > current.points[existing].value) current.points[existing] = point;
      series.set(seriesKey, current);
    });
  }));
  return [...series.values()].map((item) => {
    const points = item.points.sort((a, b) => a.date.localeCompare(b.date));
    return { ...item, points: item.metric === "e1rm" ? recentBestPoints(points) : points };
  })
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}
