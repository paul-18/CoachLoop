import { localDate, type TrainingState, type WorkoutSession } from "./training-types";

/** Restored logs can contain more than one unfinished session. Never orphan one. */
export function selectedActiveWorkout(state: TrainingState): WorkoutSession | null {
  return state.workouts.find(w => w.status === "active" && w.id === state.activeWorkoutId)
    ?? state.workouts.find(w => w.status === "active") ?? null;
}

export function resumeWorkoutState(state: TrainingState, id: string): TrainingState {
  if (!state.workouts.some(w => w.id === id && w.status === "active")) throw new Error("Choose an unfinished workout to resume");
  return { ...state, activeWorkoutId: id };
}

export function startWorkoutState(state: TrainingState, workout: WorkoutSession, now = new Date().toISOString(), today = localDate(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"): TrainingState {
  if (state.workouts.some(w => w.status === "active" && w.id !== workout.id)) throw new Error("Finish or discard the active workout first");
  const active: WorkoutSession = {
    ...workout, date: workout.status === "planned" ? today : workout.date,
    timezone: workout.status === "planned" ? timezone : workout.timezone,
    status: "active", startedAt: workout.startedAt ?? now, completedAt: null,
    skippedAt: null, skipReason: "", updatedAt: now,
  };
  const exists = state.workouts.some(w => w.id === active.id);
  return { ...state, workouts: exists ? state.workouts.map(w => w.id === active.id ? active : w) : [active, ...state.workouts], activeWorkoutId: active.id };
}

export function finishWorkoutState(state: TrainingState, workout: WorkoutSession, now = new Date().toISOString()): TrainingState {
  if (!state.workouts.some(w => w.id === workout.id)) throw new Error("This workout is no longer in the log");
  const completed: WorkoutSession = { ...workout, status: "completed", completedAt: workout.completedAt ?? now, skippedAt: null, skipReason: "", updatedAt: now };
  const next = { ...state, workouts: state.workouts.map(w => w.id === completed.id ? completed : w) };
  return { ...next, activeWorkoutId: selectedActiveWorkout(next)?.id ?? null };
}

export function discardWorkoutState(state: TrainingState, id: string): TrainingState {
  if (!state.workouts.some(w => w.id === id && w.status === "active")) throw new Error("Only an unfinished workout can be discarded");
  const next = { ...state, workouts: state.workouts.filter(w => w.id !== id), deletedWorkoutIds: [...new Set([...state.deletedWorkoutIds, id])] };
  return { ...next, activeWorkoutId: selectedActiveWorkout(next)?.id ?? null };
}
