import type { WorkoutSession } from "./training-types";
export const normalizedBlockOrder = (workout: WorkoutSession): WorkoutSession["blockOrder"] => {
  const exerciseIds = new Set(workout.exercises.map((item) => item.id));
  const activityIds = new Set(workout.cardio.map((item) => item.id));
  const seen = new Set<string>();
  const valid = (Array.isArray(workout.blockOrder) ? workout.blockOrder : []).filter((block) => {
    const exists = block.type === "exercise" ? exerciseIds.has(block.id) : activityIds.has(block.id);
    if (!exists || seen.has(block.id)) return false;
    seen.add(block.id);
    return true;
  });
  workout.exercises.forEach((item) => { if (!seen.has(item.id)) valid.push({ type: "exercise", id: item.id }); });
  workout.cardio.forEach((item) => { if (!seen.has(item.id)) valid.push({ type: "activity", id: item.id }); });
  return valid;
};

