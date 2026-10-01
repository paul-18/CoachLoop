import { exerciseIdentity, formatPerformedSet } from "./training-metrics";
import type { TrainingState } from "./training-types";

export function exerciseHistoryFor(state: TrainingState, seriesKey: string) {
  const identity = seriesKey.split("|")[0];
  return state.workouts
    .filter((workout) => workout.status === "completed")
    .flatMap((workout) => workout.exercises
      .filter((exercise) => exerciseIdentity(exercise.name, state.exerciseAliases) === identity)
      .map((exercise) => ({
        id: `${workout.id}:${exercise.id}`,
        date: workout.date,
        workoutName: workout.name,
        sets: exercise.sets.filter((set) => set.completed).map(formatPerformedSet),
      })))
    .filter((entry) => entry.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}
