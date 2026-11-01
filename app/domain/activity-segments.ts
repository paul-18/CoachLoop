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

/** Plain-words plan for one part, label first when present. Never parses the label. */
export function segmentPlanText(segment: ActivitySegment): string {
  const kindWord = segment.kind === "other" ? "Part" : segment.kind[0]!.toUpperCase() + segment.kind.slice(1);
  const measures: string[] = [];
  if (segment.plannedDurationSec != null) measures.push(segment.plannedDurationSec < 60 ? `${formatMeasure(segment.plannedDurationSec)} sec` : `${formatMeasure(segment.plannedDurationSec / 60)} min`);
  if (segment.kind !== "rest" && segment.plannedDistanceM != null) measures.push(segment.plannedDistanceM >= 1000 ? `${formatMeasure(segment.plannedDistanceM / 1000)} km` : `${formatMeasure(segment.plannedDistanceM)} m`);
  const base = segment.label?.trim() ? segment.label.trim() : kindWord;
  return measures.length ? (segment.label?.trim() ? `${base} · ${measures.join(" · ")}` : `${base} ${measures.join(" · ")}`) : base;
}

/** Labels are pipe-separated in FITLOG, so | and newlines would break parsing. Plain message, enforced in UI (v108) and parser (v110). */
export function segmentLabelError(label: string): string | null {
  if (label.includes("|")) return "Labels cannot contain |.";
  if (/[\r\n]/.test(label)) return "Labels cannot contain line breaks.";
  return null;
}

/** Compact import-preview lines in stored order: one line per ungrouped part, one collapsed line per repeat group at its first occurrence. */
export function previewSegmentLines(segments: readonly ActivitySegment[]): string[] {
  const lines: string[] = [];
  const emitted = new Set<string>();
  for (const segment of segments) {
    if (!segment.groupId) { lines.push(segmentPlanText(segment)); continue; }
    if (emitted.has(segment.groupId)) continue;
    emitted.add(segment.groupId);
    const parts = segments.filter(part => part.groupId === segment.groupId);
    const iterations = [...new Set(parts.map(part => part.iteration ?? 1))].sort((a, b) => a - b);
    const first = iterations[0] ?? 1;
    const pattern = parts.filter(part => (part.iteration ?? 1) === first);
    lines.push(`Repeat ${iterations.length}x: ${pattern.map(segmentPlanText).join(" + ")}`);
  }
  return lines;
}

/** Complete-all is unknown resolution: typed actuals become Measured, the rest complete as prescribed. Skips untouched. */
export const completeAllRemainingSegments = resolveUnknownSegments;

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
  return segments.map(segment => {
    if (segment.status !== "unknown") return segment;
    const status = segment.actualDurationSec != null || segment.actualDistanceM != null ? "modified" as const : "completed" as const;
    return { ...segment, status };
  });
}

export function completeSegmentGroup(segments: readonly ActivitySegment[], groupId: string): ActivitySegment[] {
  return segments.map(segment => {
    if (segment.groupId !== groupId || segment.status !== "unknown") return segment;
    const status = segment.actualDurationSec != null || segment.actualDistanceM != null ? "modified" as const : "completed" as const;
    return { ...segment, status };
  });
}

export type SegmentUnit = { key: string; groupId: string | null; iteration: number | null; segments: ActivitySegment[] };

/** Grouped-stepper units (v109): one REPEAT iteration = one unit (a circuit round / a swim set), in first-occurrence stored order. Ungrouped segments are single-part units. A groupId without an iteration is one unit for the whole group. */
export function segmentUnits(segments: readonly ActivitySegment[]): SegmentUnit[] {
  const units: SegmentUnit[] = [];
  const byKey = new Map<string, SegmentUnit>();
  for (const segment of segments) {
    if (!segment.groupId) { units.push({ key: `part:${segment.id}`, groupId: null, iteration: null, segments: [segment] }); continue; }
    const key = `group:${segment.groupId}:${segment.iteration ?? ""}`;
    let unit = byKey.get(key);
    if (!unit) { unit = { key, groupId: segment.groupId, iteration: segment.iteration ?? null, segments: [] }; byKey.set(key, unit); units.push(unit); }
    unit.segments.push(segment);
  }
  return units;
}

/** Complete unknown parts of ONE iteration of a group only (v109 round/set Done). Other iterations, other groups, and skips are untouched. Typed actuals become Measured, the rest complete as prescribed. */
export function completeSegmentGroupIteration(segments: readonly ActivitySegment[], groupId: string, iteration: number | null): ActivitySegment[] {
  return segments.map(segment => {
    if (segment.groupId !== groupId || (segment.iteration ?? null) !== iteration || segment.status !== "unknown") return segment;
    const status = segment.actualDurationSec != null || segment.actualDistanceM != null ? "modified" as const : "completed" as const;
    return { ...segment, status };
  });
}

/** Repeating a pattern replaces the pattern rows with fresh copies, so a pattern row that already carries entered actuals or a confirmed state would lose that data. Refuse instead of destroying it. */
export function repeatPatternError(pattern: readonly ActivitySegment[]): string | null {
  if (pattern.some(segment => segment.status !== "unknown" || segment.actualDurationSec != null || segment.actualDistanceM != null)) {
    return "Cannot repeat rows with entered results or confirmed states. Reset them to Not confirmed first.";
  }
  return null;
}

export function repeatedSegments(pattern: readonly ActivitySegment[], repetitions: number, groupId = uid("segment-group")): ActivitySegment[] {
  if (!Number.isInteger(repetitions) || repetitions < 2 || repetitions > 50) throw new Error("Repeat count must be a whole number from 2 to 50.");
  if (!pattern.length) throw new Error("Choose at least one segment to repeat.");
  if (pattern.length * repetitions > 100) throw new Error("A repeated block can create at most 100 segments.");
  return Array.from({ length: repetitions }, (_, index) => pattern.map(segment => ({
    id: uid("segment"), kind: segment.kind,
    label: segment.label,
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
