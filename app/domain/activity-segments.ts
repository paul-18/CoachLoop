import { uid, type ActivitySegment, type CardioEntry } from "./training-types";

export type SegmentMeasure = {
  value: number | null;
  fullyRecorded: boolean;
  inferred: boolean;
  measured: boolean;
  done: number;
  total: number;
};

const doneStatus = (segment: ActivitySegment) => segment.status === "completed" || segment.status === "modified";
const formatMeasure = (value: number) => String(Number(value.toFixed(2)));
export const segmentHasTypedActual = (segment: ActivitySegment) => segment.actualDurationSec != null || segment.actualDistanceM != null;

/** Planned values on completed parts are inferred; modified parts use actual values only. */
export function segmentMeasure(activity: CardioEntry, measure: "duration" | "distance", kind?: ActivitySegment["kind"]): SegmentMeasure | null {
  if (!activity.segments?.length) return null;
  const relevant = activity.segments.filter(segment => (!kind || segment.kind === kind) && !(measure === "distance" && segment.kind === "rest"));
  const done = relevant.filter(doneStatus);
  if (!done.length) return { value: null, fullyRecorded: false, inferred: false, measured: false, done: 0, total: relevant.length };
  let total = 0;
  let inferred = false;
  let measured = false;
  let missing = false;
  for (const segment of done) {
    const value = segment.status === "completed"
      ? measure === "duration" ? segment.plannedDurationSec : segment.plannedDistanceM
      : measure === "duration" ? segment.actualDurationSec : segment.actualDistanceM;
    if (value === null || value === undefined) { missing = true; continue; }
    total += value;
    if (segment.status === "completed") inferred = true;
    else measured = true;
  }
  return { value: missing ? null : total, fullyRecorded: !missing, inferred, measured, done: done.length, total: relevant.length };
}

export const segmentCounts = (segments: readonly ActivitySegment[]) => ({
  done: segments.filter(doneStatus).length,
  total: segments.length,
  completed: segments.filter(segment => segment.status === "completed").length,
  modified: segments.filter(segment => segment.status === "modified").length,
  skipped: segments.filter(segment => segment.status === "skipped").length,
  unknown: segments.filter(segment => segment.status === "unknown").length,
});

export function segmentCountLabel(segments: readonly ActivitySegment[]) {
  const { done, total } = segmentCounts(segments);
  return `${done} of ${total} parts done`;
}

export function segmentGroupProgress(segments: readonly ActivitySegment[]) {
  const iterations = new Map<number, ActivitySegment[]>();
  segments.forEach(segment => {
    if (segment.iteration === undefined) return;
    iterations.set(segment.iteration, [...(iterations.get(segment.iteration) ?? []), segment]);
  });
  const roundsDone = [...iterations.values()].filter(parts => parts.every(doneStatus)).length;
  return { roundsDone, roundsTotal: iterations.size, ...segmentCounts(segments) };
}

export function resolveUnknownSegments(segments: readonly ActivitySegment[]): ActivitySegment[] {
  return segments.map(segment => segment.status === "unknown" ? { ...segment, status: "completed" } : segment);
}

export function completeSegmentGroup(segments: readonly ActivitySegment[], groupId: string): ActivitySegment[] {
  return segments.map(segment => segment.groupId === groupId && segment.status === "unknown" ? { ...segment, status: "completed" } : segment);
}

export function repeatedSegments(pattern: readonly ActivitySegment[], repetitions: number, groupId = uid("segment-group")): ActivitySegment[] {
  if (!Number.isInteger(repetitions) || repetitions < 2 || repetitions > 50) throw new Error("Repeat count must be a whole number from 2 to 50.");
  if (!pattern.length) throw new Error("Choose at least one segment to repeat.");
  if (pattern.length * repetitions > 100) throw new Error("A repeated block can create at most 100 segments.");
  return Array.from({ length: repetitions }, (_, index) => pattern.map(segment => ({
    id: uid("segment"), kind: segment.kind,
    plannedDurationSec: segment.plannedDurationSec ?? null,
    actualDurationSec: null,
    plannedDistanceM: segment.plannedDistanceM ?? null,
    actualDistanceM: null,
    status: "unknown" as const,
    groupId, iteration: index + 1,
  }))).flat();
}

export function hasSegmentPrescription(activity: CardioEntry) {
  return activity.plannedDurationMin !== null || activity.plannedDistanceKm !== null
    || Boolean(activity.segments?.some(segment => segment.plannedDurationSec != null || segment.plannedDistanceM != null));
}

export function canCompleteAsPrescribed(activity: CardioEntry) {
  return hasSegmentPrescription(activity)
    && activity.actualDurationMin === null && activity.actualDistanceKm === null
    && !activity.segments?.some(segment => segment.status === "modified" || segment.status === "skipped" || segment.actualDurationSec != null || segment.actualDistanceM != null);
}

/** Confirm the activity, resolving untouched parts while preserving deliberate edits and skips. */
export function completeActivity(activity: CardioEntry): CardioEntry {
  const hasSegments = Boolean(activity.segments?.length);
  const segments = hasSegments ? activity.segments!.map(segment => segment.status !== "unknown" ? segment
    : segment.actualDurationSec != null || segment.actualDistanceM != null
      ? { ...segment, status: "modified" as const }
      : { ...segment, status: "completed" as const }) : activity.segments;
  const next = hasSegments ? { ...activity, segments } : activity;
  const allAsPrescribed = hasSegmentPrescription(activity)
    && activity.actualDurationMin === null && activity.actualDistanceKm === null
    && (!segments?.length || segments.every(segment => segment.status === "completed"));
  return {
    ...next,
    completed: true,
    completedAsPlanned: allAsPrescribed,
    ...(!hasSegments ? {
      actualDurationMin: activity.actualDurationMin ?? activity.plannedDurationMin,
      actualDistanceKm: activity.actualDistanceKm ?? activity.plannedDistanceKm,
    } : {}),
  };
}

export function segmentMismatch(activity: CardioEntry): { summarySeconds: number; segmentsSeconds: number; message: string } | null {
  if (activity.actualDurationMin === null) return null;
  const duration = segmentMeasure(activity, "duration");
  if (!duration?.fullyRecorded || duration.value === null) return null;
  const summarySeconds = activity.actualDurationMin * 60;
  const segmentsSeconds = duration.value;
  if (Math.abs(summarySeconds - segmentsSeconds) <= 30) return null;
  const summary = `${formatMeasure(summarySeconds / 60)} min (${formatMeasure(summarySeconds)} sec)`;
  const parts = `${formatMeasure(segmentsSeconds / 60)} min (${formatMeasure(segmentsSeconds)} sec)`;
  return { summarySeconds, segmentsSeconds, message: `Summary duration ${summary} differs from segment duration ${parts}. Both values are kept; review them.` };
}

export function formatSegmentMeasure(result: SegmentMeasure | null, unit: "duration" | "distance") {
  if (!result || !result.done) return "Not recorded";
  if (!result.fullyRecorded || result.value === null) return "Not fully recorded";
  const value = unit === "duration" ? `${formatMeasure(result.value / 60)} min` : `${formatMeasure(result.value / 1000)} km`;
  return result.inferred && result.measured ? `${value} · includes as prescribed` : result.inferred ? `${value} · as prescribed` : value;
}
