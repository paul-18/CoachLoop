import { formatMeasure } from "./completion";
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

function distanceText(kilometres: number, type: CardioEntry["activityType"]) {
  if (type === "swim" || type === "row") return `${formatMeasure(kilometres * 1000)} m`;
  return `${formatMeasure(kilometres)} km`;
}

/** Warn only when both actual distance and actual duration were entered. Planned numbers never count. */
export function unusualActivityWarning(activity: CardioEntry): string | null {
  if (activity.skipped) return null;
  const limit = FASTEST_MIN_PER_KM[activity.activityType];
  if (activity.efforts?.length) {
    const warnings = activity.efforts.flatMap((effort, index) => {
      const metres = finite(effort.actualDistanceM);
      const seconds = finite(effort.actualDurationSec);
      // Check entered results before completion too. Prescriptions are never results.
      if (metres === null || metres <= 0 || seconds === null || seconds < 0) return [];
      const distance = metres / 1000;
      const duration = seconds / 60;
      if (duration > 0 && (limit === undefined || duration / distance >= limit)) return [];
      return [`${activity.name}, effort ${index + 1}: ${distanceText(distance, activity.activityType)} in ${formatMeasure(duration)} min. ${UNUSUAL_ENTRY_MESSAGE}`];
    });
    return warnings.length ? warnings.join(" ") : null;
  }

  const distance = finite(activity.actualDistanceKm);
  const duration = finite(activity.actualDurationMin);
  if (distance === null || distance <= 0 || duration === null || duration < 0) return null;
  const tooFast = limit !== undefined && duration / distance < limit;
  if (duration > 0 && !tooFast) return null;
  return `${activity.name}: ${distanceText(distance, activity.activityType)} in ${formatMeasure(duration)} min. ${UNUSUAL_ENTRY_MESSAGE}`;
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
