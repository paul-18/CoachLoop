import assert from "node:assert/strict";
import test from "node:test";
import { defaultState, localDate, makeCardio, makeWorkout } from "../app/domain/training-types";
import { canCompleteAsPrescribed, completeActivity, completeSegmentGroup, formatSegmentMeasure, repeatedSegments, segmentCounts, segmentGroupProgress, segmentMeasure, segmentMismatch } from "../app/domain/activity-segments";
import { parseFitlog } from "../app/interchange/fitlog";
import { activityBreakdownForLastDays } from "../app/domain/training-coverage";
import { unusualActivityWarning } from "../app/domain/activity-plausibility";
import { validateSyncedState } from "../app/persistence/training-validation";

const unknown = (id: string, kind: "run" | "walk", seconds: number): import("../app/domain/training-types").ActivitySegment => ({ id, kind, plannedDurationSec: seconds, plannedDistanceM: null, actualDurationSec: null, actualDistanceM: null, status: "unknown" });

test("FITLOG v2 expands the golden repeat pattern as unknown segments", () => {
  const workout = parseFitlog(`[FITLOG:2]\nWORKOUT|Intervals|2026-01-15\nCARDIO|Run/walk\nTYPE|run\nMODE|segments\nREPEAT|6\nSEGMENT|run|4 min|\nSEGMENT|walk|1 min|\nENDREPEAT\nSEGMENT|run|10 min|\n[/FITLOG]`, "lb", {});
  const activity = workout.cardio[0];
  assert.equal(activity.segments?.length, 13);
  assert.equal(activity.segments?.every(segment => segment.status === "unknown"), true);
  assert.equal(segmentMeasure(activity, "duration")?.value, null);
  assert.equal(activity.segments?.filter(segment => segment.groupId).length, 12);
  assert.equal(new Set(activity.segments?.filter(segment => segment.groupId).map(segment => segment.groupId)).size, 1);
  assert.equal(new Set(activity.segments?.filter(segment => segment.groupId).map(segment => segment.iteration)).size, 6);
  assert.throws(() => parseFitlog(`[FITLOG:3]\nWORKOUT|Legacy|2026-01-15\nCARDIO|Run\nDURATION|4\n[/FITLOG]`, "lb", {}), /version 1/);
});

test("FITLOG v2 rejects ambiguous units, mode mismatches, nested repeats and mixed type omissions", () => {
  const base = (commands: string) => `[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nMODE|segments\n${commands}\n[/FITLOG]`;
  for (const duration of ["4", "4.5"]) assert.throws(() => parseFitlog(base(`SEGMENT|run|${duration}|`), "lb", {}), /duration requires/);
  assert.throws(() => parseFitlog(base("SEGMENT|run|4 min|800"), "lb", {}), /distance requires/);
  assert.throws(() => parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nMODE|summary\nSEGMENT|run|4 min|\n[/FITLOG]`, "lb", {}), /MODE\|summary cannot contain SEGMENT/);
  assert.throws(() => parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nMODE|segments\nSEGMENT|run|4 min|\nSEGMENT|walk|1 min|\n[/FITLOG]`, "lb", {}), /explicit TYPE/);
  assert.throws(() => parseFitlog(base("REPEAT|2\nREPEAT|2\nSEGMENT|run|4 min|\nENDREPEAT\nENDREPEAT"), "lb", {}), /REPEAT may contain only|nested/);
});

test("completion resolves untouched plans, preserves actuals and computes non-partial totals", () => {
  const activity = { ...makeCardio("run"), plannedDurationMin: 5, segments: [unknown("a", "run", 240), { ...unknown("b", "walk", 60), status: "modified" as const, actualDurationSec: 75 }, { ...unknown("c", "run", 60), status: "skipped" as const }] };
  assert.equal(canCompleteAsPrescribed(activity), false);
  assert.equal(segmentCounts(activity.segments).done, 1);
  assert.equal(segmentMeasure(activity, "duration")?.value, 75);
  const completed = completeActivity(activity);
  assert.equal(completed.segments?.[0].status, "completed");
  assert.equal(completed.segments?.[1].status, "modified");
  assert.equal(completed.segments?.[2].status, "skipped");
  assert.equal(completed.completedAsPlanned, false);
  assert.equal(segmentCounts(completed.segments!).done, 2);
  assert.equal(segmentMeasure(completed, "duration")?.value, 315);

  const missing = { ...makeCardio("run"), segments: [unknown("known", "run", 240), { ...unknown("missing", "walk", 60), status: "modified" as const }] };
  assert.equal(segmentMeasure(missing, "duration")?.value, null);
  assert.equal(formatSegmentMeasure(segmentMeasure(missing, "duration"), "duration"), "Not fully recorded");
});

test("repeat completion changes only unknown rows, retains skips, and permits 5 of 6", () => {
  const pattern = [unknown("run", "run", 240), unknown("walk", "walk", 60)];
  const repeated = repeatedSegments(pattern, 6, "group");
  const partlyDone = repeated.map(segment => segment.iteration === 6 ? { ...segment, status: "skipped" as const } : segment.iteration! < 3 ? { ...segment, status: "modified" as const, actualDurationSec: segment.plannedDurationSec } : segment);
  const result = completeSegmentGroup(partlyDone, "group");
  assert.equal(segmentCounts(result.filter(segment => segment.iteration === 6)).done, 0);
  assert.equal(segmentCounts(result.filter(segment => segment.kind === "run")).done, 5);
  assert.equal(segmentCounts(result.filter(segment => segment.kind === "walk")).done, 5);
  assert.equal(result.find(segment => segment.iteration === 6)?.status, "skipped");
  assert.equal(result.filter(segment => segment.status === "modified").length, 4);
  assert.equal(segmentGroupProgress(result).roundsDone, 5);
  assert.equal(segmentGroupProgress(result).roundsTotal, 6);
  assert.throws(() => repeatedSegments(pattern, 1), /2 to 50/);
  assert.throws(() => repeatedSegments(Array.from({ length: 3 }, (_, i) => unknown(String(i), "run", 10)), 50), /100 segments/);
});

test("mismatch warning is over 30 seconds and leaves summary and segment values untouched", () => {
  const within = { ...makeCardio("run"), actualDurationMin: 5, segments: [{ ...unknown("s", "run", 300), status: "completed" as const }] };
  assert.equal(segmentMismatch({ ...within, actualDurationMin: 5.5 }), null);
  const warning = segmentMismatch({ ...within, actualDurationMin: 6 });
  assert.ok(warning);
  assert.equal(warning.summarySeconds, 360);
  assert.equal(warning.segmentsSeconds, 300);
  assert.equal(within.actualDurationMin, 5);
  assert.equal(within.segments?.[0].plannedDurationSec, 300);
});

test("running totals count one run session and exclude walk segments", () => {
  const workout = makeWorkout("lb", 120);
  workout.date = localDate();
  workout.status = "completed";
  workout.completedAt = new Date().toISOString();
  const activity = { ...makeCardio("run"), completed: true, segments: [
    { ...unknown("r", "run", 240), status: "completed" as const, plannedDistanceM: 1000 },
    { ...unknown("w", "walk", 600), status: "completed" as const, plannedDistanceM: 500 },
  ] };
  workout.cardio = [activity];
  workout.blockOrder = [{ type: "activity", id: activity.id }];
  const totals = activityBreakdownForLastDays({ ...defaultState(), workouts: [workout] }, "lb").runs;
  assert.equal(totals.sessions, 1);
  assert.equal(totals.minutes, 4);
  assert.equal(totals.distanceKm, 1);
});

test("segment plausibility checks run and walk by their own kind and ignores duration-only parts", () => {
  const activity = { ...makeCardio("run"), segments: [
    { ...unknown("run-fast", "run", 10), status: "completed" as const, plannedDistanceM: 100 },
    { ...unknown("walk-fast", "walk", 15), status: "completed" as const, plannedDistanceM: 100 },
    { ...unknown("no-distance", "run", 10), status: "completed" as const },
  ] };
  const warning = unusualActivityWarning(activity) ?? "";
  assert.match(warning, /run segment 1/);
  assert.match(warning, /walk segment 2/);
  assert.doesNotMatch(warning, /segment 3/);
});

test("repeated segment IDs and grouped iterations survive strict state validation and backup JSON", () => {
  const workout = makeWorkout("lb", 120);
  workout.cardio = [{ ...makeCardio("run"), segments: repeatedSegments([unknown("pattern-run", "run", 240), unknown("pattern-walk", "walk", 60)], 6, "six-rounds") }];
  workout.blockOrder = [{ type: "activity", id: workout.cardio[0].id }];
  const raw = { ...defaultState(), workouts: [workout], activeWorkoutId: workout.id };
  const restored = validateSyncedState(JSON.parse(JSON.stringify(raw)));
  assert.equal(restored.workouts[0].cardio[0].segments?.length, 12);
  assert.equal(new Set(restored.workouts[0].cardio[0].segments?.map(segment => segment.id)).size, 12);
  assert.equal(new Set(restored.workouts[0].cardio[0].segments?.map(segment => segment.iteration)).size, 6);
});

test("FITLOG v2 rejects segmented yoga but still imports summary yoga and segmented grappling", () => {
  assert.throws(() => parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Yoga flow\nTYPE|yoga\nMODE|segments\nSEGMENT|other|5 min|\nSEGMENT|rest|1 min|\n[/FITLOG]`, "lb", {}), /Yoga is recorded after the session: use MODE\|summary with DURATION and NOTES, not SEGMENT lines\./);
  const summaryYoga = parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Yoga after Down Dog\nTYPE|yoga\nMODE|summary\nDURATION|30\nNOTES|Down Dog, restorative flow.\n[/FITLOG]`, "lb", {});
  assert.equal(summaryYoga.cardio[0].activityType, "yoga");
  assert.equal(summaryYoga.cardio[0].segments?.length ?? 0, 0);
  const grappling = parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|BJJ class\nTYPE|grappling\nMODE|segments\nSEGMENT|other|5 min|\nSEGMENT|other|5 min|\n[/FITLOG]`, "lb", {});
  assert.equal(grappling.cardio[0].segments?.length, 2);
});
