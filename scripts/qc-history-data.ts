/** Deterministic synthetic records; never restore into a personal log. */
import { defaultState, makeWorkout, makeExercise, makeSet } from "../app/domain/training-types";

export function syntheticHistory(count: number) {
  const state = defaultState();
  const end = Date.UTC(2026, 9, 4, 12);
  for (let i = 0; i < count; i++) {
    const date = new Date(end - (count - 1 - i) * 86400000).toISOString();
    const workout = makeWorkout("lb", 120, `SYNTHETIC QC ${i + 1} — Full body`);
    Object.assign(workout, { id: `qc-workout-${i}`, date: date.slice(0, 10), timezone: "UTC", createdAt: date, startedAt: date, completedAt: date, updatedAt: date, status: "completed" });
    workout.exercises = ["Barbell Bench Press", "Barbell Squat", "Cable Seated Row", "Dumbbell Romanian Deadlift"].map((name, e) => {
      const exercise = makeExercise("lb", 120, name);
      exercise.id = `qc-exercise-${i}-${e}`; exercise.updatedAt = date;
      exercise.sets = Array.from({ length: 3 }, (_, s) => makeSet("lb", {
        id: `qc-set-${i}-${e}-${s}`, plannedReps: "8", actualReps: "8", actualWeight: 80 + e * 20 + i % 30,
        loadType: "weighted", completed: true, updatedAt: date,
      }));
      return exercise;
    });
    workout.blockOrder = workout.exercises.map(exercise => ({ type: "exercise", id: exercise.id }));
    state.workouts.push(workout);
  }
  state.coachProfile = "SYNTHETIC QC DATA — not a real athlete.";
  state.goals = ["SYNTHETIC QC: verify history and backup"];
  state.coachProfileUpdatedAt = state.goalsUpdatedAt = new Date(end).toISOString();
  return state;
}
