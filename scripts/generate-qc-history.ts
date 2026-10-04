/** Synthetic stress-test data only. Never restore this into a real training log. */
import { writeFileSync } from "node:fs";
import { defaultState, makeWorkout, makeExercise, makeSet } from "../app/domain/training-types";
import { serializeBackup, parseBackup } from "../app/persistence/backup-tools";

const state = defaultState();
const end = Date.UTC(2026, 9, 4, 12);
for (let i = 0; i < 1000; i++) {
  const date = new Date(end - (999 - i) * 2 * 86400000).toISOString();
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
state.coachProfile = "SYNTHETIC QC DATA — not a real athlete. Test-only browser log.";
state.goals = ["SYNTHETIC QC: verify large-history navigation", "SYNTHETIC QC: verify backup round trip"];
state.coachProfileUpdatedAt = state.goalsUpdatedAt = new Date(end).toISOString();
const started = performance.now();
const text = serializeBackup(state);
const restored = parseBackup(text);
if (restored.workouts.length !== 1000 || restored.workouts.reduce((n, w) => n + w.exercises.reduce((s, e) => s + e.sets.length, 0), 0) !== 12000) throw new Error("Synthetic round trip failed");
const output = process.argv[2];
if (!output) throw new Error("Usage: node --import tsx scripts/generate-qc-history.ts OUTPUT.json");
writeFileSync(output, text);
console.log(JSON.stringify({ workouts: 1000, sets: 12000, bytes: Buffer.byteLength(text), roundTripMs: Math.round(performance.now() - started) }));
