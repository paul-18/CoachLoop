import { canonicalExerciseName, convertWeight, estimatedOneRepMax, parseExactReps, performedReps, performedWeight } from "./training-metrics";
import { localDateDaysEarlier } from "./training-insights";
import { localDate, type TrainingState, type Unit } from "./training-types";

export type ProfileLift = "Bench press" | "Squat" | "Deadlift" | "Overhead press" | "Pull-ups";
export type ProfileResult = { lift: ProfileLift; date: string; display: string; value: number; reps: number };

const liftFor = (name: string): ProfileLift | null => {
  const value = name.toLowerCase().replace(/[-_]/g, " ");
  if (/incline|decline|dumbbell|\bdb\b|machine|smith|close grip|floor press|pause/.test(value)) return null;
  if (/\b(?:barbell |flat )?bench press\b/.test(value)) return "Bench press";
  if (/\b(?:back |barbell )?squat\b/.test(value) && !/front|split|hack|goblet|box/.test(value)) return "Squat";
  if (/\b(?:conventional |sumo |barbell )?deadlift\b/.test(value) && !/romanian|stiff|trap|hex|rdl/.test(value)) return "Deadlift";
  if (/\bohp\b|\b(?:overhead|military|barbell shoulder) press\b/.test(value)) return "Overhead press";
  if (/\b(?:pull ?ups?|chin ?ups?)\b/.test(value)) return "Pull-ups";
  return null;
};

export function strengthProfile(state: TrainingState, unit: Unit, days = 42) {
  const results = new Map<ProfileLift, ProfileResult>();
  const since = localDateDaysEarlier(days - 1);
  for (const workout of state.workouts) {
    if (workout.status !== "completed" || workout.date < since || workout.date > localDate()) continue;
    for (const exercise of workout.exercises) {
      const lift = liftFor(canonicalExerciseName(exercise.name, state.exerciseAliases));
      if (!lift) continue;
      for (const set of exercise.sets) {
        if (!set.completed || set.warmup) continue;
        const reps = parseExactReps(performedReps(set));
        if (reps === null || reps < 1) continue;
        const weight = performedWeight(set);
        if (lift === "Pull-ups") {
          // Added weight and assistance are different tests; show strict bodyweight reps only.
          if (set.loadType !== "bodyweight") continue;
          const current = results.get(lift);
          if (!current || reps > current.value) results.set(lift, { lift, date: workout.date, display: `${reps} reps`, value: reps, reps });
        } else {
          if (set.loadType !== "weighted" || set.weightMode !== "total" || weight === null || weight <= 0 || reps > 10) continue;
          const value = estimatedOneRepMax(convertWeight(weight, set.unit, unit), reps);
          if (value === null) continue;
          const current = results.get(lift);
          if (!current || value > current.value) results.set(lift, { lift, date: workout.date, display: `${weight} ${set.unit} × ${reps}`, value, reps });
        }
      }
    }
  }
  return results;
}

// Loose planning guides, not population norms or injury thresholds.
export const strengthComparisons: Array<{ lift: ProfileLift; anchor: ProfileLift; guide: number; label: string }> = [
  { lift: "Squat", anchor: "Bench press", guide: 1.25, label: "Squat vs bench" },
  { lift: "Deadlift", anchor: "Squat", guide: 1.1, label: "Deadlift vs squat" },
  { lift: "Overhead press", anchor: "Bench press", guide: 0.55, label: "Press vs bench" },
];
