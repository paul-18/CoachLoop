import type { CardioEntry, TrainingSet, TrainingState } from "../domain/training-types";

export function materializeAcceptedSet(set: TrainingSet): TrainingSet {
  if (!set.completed || !set.completedAsPlanned) return set;
  return {
    ...set,
    actualReps: set.actualReps.trim() ? set.actualReps : set.plannedReps,
    actualWeight: set.actualWeight ?? set.plannedWeight,
  };
}

export function materializeAcceptedActivity(activity: CardioEntry): CardioEntry {
  if (!activity.completed || !activity.completedAsPlanned) return activity;
  return {
    ...activity,
    actualDurationMin: activity.actualDurationMin ?? activity.plannedDurationMin,
    actualDistanceKm: activity.actualDistanceKm ?? activity.plannedDistanceKm,
  };
}

/** Explicit one-time repair of recorded "completed as planned" legacy results. */
export function migrateAcceptedEvidence(state: TrainingState): TrainingState {
  if (state.evidenceVersion === 2) return state;
  return {
    ...state,
    evidenceVersion: 2,
    workouts: state.workouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => ({
        ...exercise, sets: exercise.sets.map(materializeAcceptedSet),
      })),
      cardio: workout.cardio.map(materializeAcceptedActivity),
    })),
  };
}
