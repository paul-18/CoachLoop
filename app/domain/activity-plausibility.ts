import { formatMeasure, performedDistance, performedDuration } from "./completion";
import type { CardioEntry, WorkoutSession } from "./training-types";

/** Shown before an impossible distance/duration pair is saved. Values are not rewritten. */
export const UNUSUAL_ENTRY_MESSAGE = "That distance and duration look unusual. Check your entry before saving.";

/**
 * Faster than these minutes-per-kilometre is treated as a typing mistake, not a
 * record. Thresholds sit beyond elite sustained efforts (a sub-2:00/km run,
 * a 100 km/h bike, a sub-4:00/km swim) and still allow a fast 5k, ruck, or ride.
 * The user can confirm and keep the numbers.
 */
const FASTEST_MIN_PER_KM: Partial<Record<CardioEntry["activityType"], number>> = {
  run: 2,
  walk: 3,
  hike: 3,
  ruck: 3,
  bike: 0.6,
  swim: 4,
  row: 1.5,
};

const finite = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? null : value;

function loggedDistance(activity: CardioEntry) {
  if (activity.efforts?.length) return finite(performedDistance(activity));
  return finite(activity.actualDistanceKm ?? activity.plannedDistanceKm);
}

function loggedDuration(activity: CardioEntry) {
  if (activity.efforts?.length) return finite(performedDuration(activity));
  return finite(activity.actualDurationMin ?? activity.plannedDurationMin);
}

function distanceText(kilometres: number, type: CardioEntry["activityType"]) {
  if (type === "swim" || type === "row") return `${formatMeasure(kilometres * 1000)} m`;
  return `${formatMeasure(kilometres)} km`;
}

/** Warn only after the user has entered a result or marked the activity complete. */
export function unusualActivityWarning(activity: CardioEntry): string | null {
  if (activity.skipped) return null;
  const entered = activity.completed
    || activity.actualDistanceKm !== null
    || activity.actualDurationMin !== null
    || !!activity.efforts?.some(effort => effort.completed);
  if (!entered) return null;
  const distance = loggedDistance(activity);
  if (distance === null || distance <= 0) return null;
  const duration = loggedDuration(activity);
  const missingTime = duration === null || duration <= 0;
  const limit = FASTEST_MIN_PER_KM[activity.activityType];
  const tooFast = !missingTime && limit !== undefined && duration / distance < limit;
  if (!missingTime && !tooFast) return null;
  const time = missingTime ? "0 min" : `${formatMeasure(duration)} min`;
  return `${activity.name}: ${distanceText(distance, activity.activityType)} in ${time}. ${UNUSUAL_ENTRY_MESSAGE}`;
}

export function unusualWorkoutWarning(workout: WorkoutSession): string | null {
  const notes = workout.cardio.map(unusualActivityWarning).filter((note): note is string => Boolean(note));
  return notes.length ? notes.join(" ") : null;
}

/** The finish button is the explicit confirm. It does not change the stored numbers. */
export function unusualSaveLabel(warning: string | null, saving: boolean, normalLabel: string) {
  if (saving) return "Saving…";
  return warning ? "Save unusual entry" : normalLabel;
}
