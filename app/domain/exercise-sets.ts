import { makeSet, type ExerciseBlock } from "./training-types";

/** Insert a fresh prescription by stable ID. Recorded results on surrounding
 * sets are retained verbatim; no actuals or completion flags are copied. */
export function insertExerciseSet(exercise: ExerciseBlock, anchorId: string, position: "before" | "after"): ExerciseBlock {
  const index = exercise.sets.findIndex(set => set.id === anchorId);
  if (index < 0) throw new Error("The selected set no longer exists");
  const anchor = exercise.sets[index];
  const inserted = makeSet(anchor.unit, {
    plannedReps: anchor.plannedReps,
    plannedWeight: anchor.plannedWeight,
    plannedRpe: anchor.plannedRpe,
    plannedRir: anchor.plannedRir,
    loadType: anchor.loadType,
    weightMode: anchor.weightMode,
    warmup: anchor.warmup,
  });
  const sets = [...exercise.sets];
  sets.splice(index + (position === "after" ? 1 : 0), 0, inserted);
  return { ...exercise, sets, updatedAt: new Date().toISOString() };
}
