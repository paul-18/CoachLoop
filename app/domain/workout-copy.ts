import { localDate, uid, type WorkoutSession } from "./training-types";
import { normalizedBlockOrder } from "./block-order";
import { performedReps, performedWeight, performedDuration, performedDistance } from "./training-metrics";

/** Copies targets with fresh IDs; completed results never transfer as actuals. */
export function repeatWorkoutDraft(original: WorkoutSession): WorkoutSession {
    const exerciseIds = new Map(original.exercises.map((exercise) => [exercise.id, uid("exercise")]));
    const activityIds = new Map(original.cardio.map((activity) => [activity.id, uid("cardio")]));
    const repeated: WorkoutSession = {
      ...structuredClone(original),
      id: uid("workout"),
      name: original.name,
      originKey: undefined,
      importFingerprint: undefined,
      importWarnings: undefined,
      date: localDate(),
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      skippedAt: null,
      skipReason: "",
      status: "active",
      source: "repeat",
      notes: "",
      sessionRpe: "",
      updatedAt: new Date().toISOString(),
      exercises: original.exercises.map((exercise) => ({ ...structuredClone(exercise), id: exerciseIds.get(exercise.id)!, updatedAt: new Date().toISOString(), notes: "", sets: exercise.sets.map((set) => ({ ...set, id: uid("set"), plannedReps: set.completed ? performedReps(set) || set.plannedReps : set.plannedReps, plannedWeight: set.completed ? performedWeight(set) : set.plannedWeight, actualReps: "", actualWeight: null, rpe: "", rir: "", completed: false, skipped: false, completedAsPlanned: false, notes: "", updatedAt: new Date().toISOString() })) })),
      cardio: original.cardio.map((item) => ({ ...structuredClone(item), id: activityIds.get(item.id)!, plannedDurationMin: item.completed ? performedDuration(item) : item.plannedDurationMin, plannedDistanceKm: item.completed ? performedDistance(item) : item.plannedDistanceKm, efforts: (item.efforts ?? []).map((entry) => ({ ...entry, id: uid("effort"), plannedDistanceM: entry.completed ? entry.actualDistanceM : entry.plannedDistanceM, plannedDurationSec: entry.completed ? entry.actualDurationSec : entry.plannedDurationSec, plannedLoad: entry.completed ? entry.actualLoad : entry.plannedLoad, actualDistanceM: null, actualDurationSec: null, actualLoad: null, completed: false })), actualDurationMin: null, actualDistanceKm: null, averageHr: null, elevationM: null, pace: "", effort: "", completed: false, skipped: false, completedAsPlanned: false, notes: "", updatedAt: new Date().toISOString() })),
      blockOrder: normalizedBlockOrder(original).map((block) => ({ type: block.type, id: block.type === "exercise" ? exerciseIds.get(block.id)! : activityIds.get(block.id)! })),
    };
  return repeated;
}

/** Requeues a skipped prescription without inventing completion. */
export function replanWorkoutDraft(original: WorkoutSession): WorkoutSession {
    const exerciseIds = new Map(original.exercises.map((exercise) => [exercise.id, uid("exercise")]));
    const activityIds = new Map(original.cardio.map((activity) => [activity.id, uid("cardio")]));
    const replanned: WorkoutSession = {
      ...structuredClone(original),
      id: uid("workout"),
      originKey: undefined,
      date: localDate(),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      skippedAt: null,
      skipReason: "",
      status: "planned",
      source: "repeat",
      updatedAt: new Date().toISOString(),
      exercises: original.exercises.map((item) => ({
        ...structuredClone(item),
        id: exerciseIds.get(item.id)!,
        notes: "",
        sets: item.sets.map((set) => ({ ...set, id: uid("set"), actualReps: "", actualWeight: null, rpe: "", rir: "", completed: false, skipped: false, completedAsPlanned: false, notes: "" })),
      })),
      cardio: original.cardio.map((item) => ({ ...structuredClone(item), id: activityIds.get(item.id)!, efforts: (item.efforts ?? []).map((entry) => ({ ...entry, id: uid("effort"), actualDistanceM: null, actualDurationSec: null, actualLoad: null, completed: false })), actualDurationMin: null, actualDistanceKm: null, effort: "", completed: false, skipped: false, completedAsPlanned: false, notes: "" })),
      blockOrder: normalizedBlockOrder(original).map((block) => ({ type: block.type, id: block.type === "exercise" ? exerciseIds.get(block.id)! : activityIds.get(block.id)! })),
    };
  return replanned;
}
