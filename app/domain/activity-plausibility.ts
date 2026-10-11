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

/** Actual kilometres only. Planned distance is not a result. */
function actualKilometres(activity: CardioEntry): number | null {
  if (activity.efforts?.length) {
    const pair = completedEffortPair(activity);
    return pair ? pair.distanceKm : null;
  }
  return finite(activity.actualDistanceKm);
}

/** Actual minutes only. Null means the time was never entered, not zero. */
function actualMinutes(activity: CardioEntry): number | null {
  if (activity.efforts?.length) {
    const pair = completedEffortPair(activity);
    return pair ? pair.durationMin : null;
  }
  return finite(activity.actualDurationMin);
}

/** Both sides of every completed effort that has a result, or nothing if one side is missing. */
function completedEffortPair(activity: CardioEntry): { distanceKm: number; durationMin: number } | null {
  const completed = (activity.efforts ?? []).filter((effort) => effort.completed);
  let distanceKm = 0;
  let durationMin = 0;
  let saw = false;
  for (const effort of completed) {
    const metres = finite(effort.actualDistanceM);
    const seconds = finite(effort.actualDurationSec);
    if (metres === null && seconds === null) continue;
    if (metres === null || seconds === null || metres < 0 || seconds < 0) return null;
    distanceKm += metres / 1000;
    durationMin += seconds / 60;
    saw = true;
  }
  return saw ? { distanceKm, durationMin } : null;
}

function distanceText(kilometres: number, type: CardioEntry["activityType"]) {
  if (type === "swim" || type === "row") return `${formatMeasure(kilometres * 1000)} m`;
  return `${formatMeasure(kilometres)} km`;
}

/** Warn only when both actual distance and actual duration were entered. Planned numbers never count. */
export function unusualActivityWarning(activity: CardioEntry): string | null {
  if (activity.skipped) return null;
  const distance = actualKilometres(activity);
  const duration = actualMinutes(activity);
  if (distance === null || distance <= 0 || duration === null || duration < 0) return null;
  const limit = FASTEST_MIN_PER_KM[activity.activityType];
  const tooFast = limit !== undefined && duration / distance < limit;
  if (duration > 0 && !tooFast) return null;
  const time = `${formatMeasure(duration)} min`;
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
