import assert from "node:assert/strict";
import test from "node:test";
import { completeActivity, completeSegmentGroup, formatSegmentMeasure, repeatPatternError, resolveUnknownSegments, segmentMeasure, segmentMismatch } from "../app/domain/activity-segments";
import { activityHistoryLabel, markTypedActivitiesComplete } from "../app/domain/completion";
import { DEFAULT_QUICK_LOG_ACTIVITIES, defaultState, localDate, makeCardio, makeWorkout, STARTER_QUICK_LOG_ACTIVITIES, type ActivitySegment, type CardioEntry } from "../app/domain/training-types";
import { activityRows, activityTotals } from "../app/domain/training-workflow";
import { activityBreakdownForLastDays } from "../app/domain/training-coverage";
import { planDifferences } from "../app/domain/plan-review";
import { repeatWorkoutDraft, replanWorkoutDraft } from "../app/domain/workout-copy";
import { blankStartState, undoBlankStart } from "../app/views/starter-plan";
import { exampleFitlog, exampleFitlogV2, parseFitlog } from "../app/interchange/fitlog";
import { serializeBackup } from "../app/persistence/backup-tools";
import { parseBackupReview as parseBackupReviewV105 } from "./fixtures/v105-settings-gate";
import { validateSyncedState } from "../app/persistence/training-validation";
import { workoutToText } from "../app/interchange/coach-export";
import { trainingCsvRows } from "../app/interchange/training-csv";

const seg = (id: string, kind: "run" | "walk" | "rest" | "other", plannedDurationSec: number | null, extra: Partial<ActivitySegment> = {}): ActivitySegment => ({
  id, kind, plannedDurationSec, plannedDistanceM: null, actualDurationSec: null, actualDistanceM: null, status: "unknown", ...extra,
});

const segmentedRun = (segments: ActivitySegment[], extra: Partial<CardioEntry> = {}): CardioEntry => ({
  ...makeCardio("run"), name: "Run", segments, ...extra,
});

test("v107: repeat refuses pattern rows with entered results or confirmed states", () => {
  assert.equal(repeatPatternError([seg("a", "run", 240)]), null);
  assert.match(repeatPatternError([seg("a", "run", 240, { actualDurationSec: 250 })]) ?? "", /Not confirmed/);
  assert.match(repeatPatternError([seg("a", "run", 240, { status: "modified" as const, actualDurationSec: 250 })]) ?? "", /Not confirmed/);
  assert.match(repeatPatternError([seg("a", "run", 240, { status: "completed" as const })]) ?? "", /Not confirmed/);
});

test("v107: group tap and unknown resolution mark typed actuals as modified", () => {
  const segments = [
    seg("a", "run", 240, { groupId: "g", iteration: 1 }),
    seg("b", "walk", 60, { groupId: "g", iteration: 1, actualDurationSec: 70 }),
    seg("c", "run", 240, { groupId: "g", iteration: 2, status: "skipped" as const }),
  ];
  const grouped = completeSegmentGroup(segments, "g");
  assert.equal(grouped[0]?.status, "completed");
  assert.equal(grouped[1]?.status, "modified");
  assert.equal(grouped[2]?.status, "skipped");
  const resolved = resolveUnknownSegments(segments);
  assert.equal(resolved[0]?.status, "completed");
  assert.equal(resolved[1]?.status, "modified");
});

test("v107: mark-typed completes a segmented parent only when no unknown parts remain", () => {
  const activity = segmentedRun([
    seg("a", "run", 240, { actualDurationSec: 250 }),
    seg("b", "walk", 60),
  ]);
  const workout = { ...makeWorkout("lb", 20, "Test"), status: "completed" as const, cardio: [activity] };
  const partly = markTypedActivitiesComplete(workout, [activity.id]);
  assert.equal(partly.cardio[0]?.segments?.[0]?.status, "modified");
  assert.equal(partly.cardio[0]?.completed, false);
  const resolved = { ...activity, segments: [seg("a", "run", 240, { actualDurationSec: 250 }), seg("b", "walk", 60, { status: "completed" as const })] };
  const done = markTypedActivitiesComplete({ ...workout, cardio: [resolved] }, [activity.id]);
  assert.equal(done.cardio[0]?.completed, true);
  assert.equal(done.cardio[0]?.completedAsPlanned, false);
});

test("v107: history badge restores As prescribed and Completed for fully resolved segmented activities", () => {
  const base = segmentedRun([seg("a", "run", 240, { status: "completed" as const })]);
  assert.equal(activityHistoryLabel({ ...base, completed: true, completedAsPlanned: true }), "As prescribed");
  assert.equal(activityHistoryLabel({ ...base, completed: true, completedAsPlanned: false }), "Completed");
  const withSkip = segmentedRun([
    seg("a", "run", 240, { status: "completed" as const }),
    seg("b", "walk", 60, { status: "skipped" as const }),
  ]);
  assert.equal(activityHistoryLabel({ ...withSkip, completed: true, completedAsPlanned: false }), "1 of 2 intervals done");
});

test("v107: totals flags carry incompleteness instead of zeroing it", () => {
  const activity = segmentedRun([
    seg("a", "run", 300, { status: "completed" as const, plannedDistanceM: 1000 }),
    seg("b", "walk", 300, { status: "completed" as const }),
  ]);
  const workout = { ...makeWorkout("lb", 20, "Test"), status: "completed" as const, date: localDate(), cardio: [activity] };
  const state = { ...defaultState(), workouts: [workout] };
  const totals = activityTotals(activityRows(state));
  assert.equal(totals.minutes, 10);
  assert.equal(totals.distance, 0);
  assert.equal(totals.minutesIncomplete, false);
  assert.equal(totals.distanceIncomplete, true);
  const breakdown = activityBreakdownForLastDays({ ...defaultState(), workouts: [{ ...workout, cardio: [{ ...makeCardio("ruck"), name: "Ruck", segments: [seg("a", "other", 600, { status: "modified" as const, actualDurationSec: 600 })] }] }] }, "lb");
  assert.equal(breakdown.rucks.distanceIncomplete, true);
});

test("v107: inferred totals keep their as-prescribed labelling", () => {
  const only = segmentedRun([seg("a", "run", 300, { status: "completed" as const })]);
  assert.equal(formatSegmentMeasure(segmentMeasure(only, "duration"), "duration"), "5 min · as prescribed");
  const mixed = segmentedRun([
    seg("a", "run", 300, { status: "completed" as const }),
    seg("b", "run", 300, { status: "modified" as const, actualDurationSec: 280 }),
  ]);
  assert.equal(formatSegmentMeasure(segmentMeasure(mixed, "duration"), "duration"), "9.67 min · includes as prescribed");
});

test("v107: mismatch tolerance warns at 31 seconds but not at 29", () => {
  const base = segmentedRun([seg("a", "run", 629, { status: "completed" as const })], { actualDurationMin: 10 });
  assert.equal(segmentMismatch(base), null);
  const over = segmentedRun([seg("a", "run", 631, { status: "completed" as const })], { actualDurationMin: 10 });
  assert.match(segmentMismatch(over)?.message ?? "", /differs from segment duration/);
});

test("v107: coach export keeps detail fields, groups repeats, and hides rest distance", () => {
  const activity = segmentedRun([
    seg("a", "run", 240, { groupId: "g", iteration: 1, status: "completed" as const }),
    seg("b", "walk", 60, { groupId: "g", iteration: 1, status: "completed" as const }),
    seg("c", "rest", 60, { status: "completed" as const, plannedDistanceM: 500 }),
  ], { completed: true, completedAsPlanned: false, pace: "5:00/km", averageHr: 150, elevationM: 80, effort: "7", notes: "Felt strong" });
  const workout = { ...makeWorkout("lb", 20, "Intervals"), status: "completed" as const, cardio: [activity] };
  const text = workoutToText(workout);
  assert.match(text, /Pace: 5:00\/km/);
  assert.match(text, /Average HR: 150 bpm/);
  assert.match(text, /Elevation: 80 m/);
  assert.match(text, /Notes: Felt strong/);
  assert.match(text, /Repeat group · 1 of 1 repeats done · 2 of 2 intervals/);
  const restLine = text.split("\n").find(line => line.includes("REST"));
  assert.ok(restLine && !restLine.includes("km"), `rest line must not show distance: ${restLine}`);
});

test("v107: plan review reports Not fully recorded and compares against segment plans", () => {
  const incomplete = segmentedRun([
    seg("a", "run", 300, { status: "completed" as const }),
    seg("b", "walk", 300, { status: "modified" as const, actualDistanceM: 500 }),
  ], { completed: true });
  const changes = planDifferences({ ...makeWorkout("lb", 20, "Test"), status: "completed" as const, cardio: [incomplete] });
  assert.ok(changes.some(line => line.includes("Not fully recorded")), changes.join(" | "));
  const changed = segmentedRun([
    seg("a", "run", 600, { status: "modified" as const, actualDurationSec: 480 }),
  ], { completed: true });
  const changedLines = planDifferences({ ...makeWorkout("lb", 20, "Test"), status: "completed" as const, cardio: [changed] });
  assert.ok(changedLines.some(line => line.includes("10 min") && line.includes("8 min")), changedLines.join(" | "));
});

test("v107: csv marks incomplete segment measures instead of blanking them", () => {
  const activity = segmentedRun([
    seg("a", "run", 300, { status: "completed" as const, plannedDistanceM: 1000 }),
    seg("b", "walk", 300, { status: "completed" as const }),
  ], { completed: true });
  const workout = { ...makeWorkout("lb", 20, "Test"), status: "completed" as const, cardio: [activity] };
  const rows = trainingCsvRows({ ...defaultState(), workouts: [workout] });
  const row = rows.find(item => item[4] === "Run");
  assert.ok(row);
  assert.equal(row[15], "10");
  assert.equal(row[16], "Not fully recorded");
});

test("v107: repeat and replan reset segments without carrying results", () => {
  const activity = segmentedRun([
    seg("a", "run", 300, { groupId: "g", iteration: 1, status: "completed" as const }),
    seg("b", "run", 300, { groupId: "g", iteration: 2, status: "modified" as const, actualDurationSec: 280, plannedDurationSec: 300 }),
  ], { completed: true, actualDurationMin: 9.67 });
  const original = { ...makeWorkout("lb", 20, "Test"), status: "completed" as const, cardio: [activity] };
  const repeated = repeatWorkoutDraft(original);
  const replaned = replanWorkoutDraft(original);
  for (const draft of [repeated, replaned]) {
    const segments = draft.cardio[0]?.segments ?? [];
    assert.equal(segments.length, 2);
    assert.equal(segments.every(segment => segment.status === "unknown" && segment.actualDurationSec === null && segment.actualDistanceM === null), true);
    assert.equal(segments[0]?.groupId, "g");
    assert.equal(segments[1]?.iteration, 2);
    assert.notEqual(segments[0]?.id, "a");
  }
  assert.equal(repeated.cardio[0]?.segments?.[1]?.plannedDurationSec, 280);
  assert.equal(replaned.cardio[0]?.segments?.[1]?.plannedDurationSec, 300);
});

test("v107: default backups carry no quick-log list, so v105 accepts them", () => {
  const text = serializeBackup(defaultState());
  const parsed = JSON.parse(text) as { settings: Record<string, unknown> };
  assert.equal(parsed.settings.quickLogActivities, undefined);
  assert.ok(DEFAULT_QUICK_LOG_ACTIVITIES.includes("walk"));
  assert.deepEqual(STARTER_QUICK_LOG_ACTIVITIES, ["run", "bike", "circuit", "yoga"]);
  assert.doesNotThrow(() => parseBackupReviewV105(text));
  const withWalk = JSON.stringify({ ...JSON.parse(text), settings: { ...parsed.settings, quickLogActivities: ["run", "walk"] } });
  assert.throws(() => parseBackupReviewV105(withWalk));
  const blank = blankStartState(defaultState());
  assert.deepEqual(blank.settings.quickLogActivities, [...STARTER_QUICK_LOG_ACTIVITIES]);
  assert.equal(undoBlankStart(blank).settings.quickLogActivities, undefined);
});

test("v107: segment schema rejects dangling groups, bad iterations, and duplicate ids", () => {
  const withSegments = (segments: ActivitySegment[]) => ({ ...defaultState(), workouts: [{ ...makeWorkout("lb", 20, "Test"), status: "completed" as const, cardio: [segmentedRun(segments)] }] });
  assert.throws(() => validateSyncedState(withSegments([seg("a", "run", 60, { groupId: "g" })])), /both groupId and iteration/);
  assert.throws(() => validateSyncedState(withSegments([seg("a", "run", 60, { groupId: "g", iteration: 0 })])), /iteration/);
  assert.throws(() => validateSyncedState(withSegments([seg("a", "run", 60, { groupId: "g", iteration: 51 })])), /iteration/);
  assert.throws(() => validateSyncedState(withSegments([seg("a", "run", 60), seg("a", "walk", 60)])), /segment/);
});

test("v107: FITLOG v2 nested repeats name the nesting fault", () => {
  const base = (commands: string) => `[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nMODE|segments\n${commands}\n[/FITLOG]`;
  assert.throws(() => parseFitlog(base("REPEAT|2\nREPEAT|2\nSEGMENT|run|4 min|\nENDREPEAT\nENDREPEAT"), "lb", {}), /repeat blocks cannot be nested/);
});

test("v107: FITLOG v2 caps the projected expansion and the clock form", () => {
  const pattern = (count: number) => `[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nTYPE|run\nMODE|segments\nREPEAT|${count}\nSEGMENT|run|4 min|\nSEGMENT|walk|1 min|\nSEGMENT|run|4 min|\nENDREPEAT\n[/FITLOG]`;
  assert.throws(() => parseFitlog(pattern(50), "lb", {}), /limited to 100 segments/);
  assert.equal(parseFitlog(pattern(2), "lb", {}).cardio[0]?.segments?.length, 6);
  const clock = (duration: string) => `[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nMODE|segments\nSEGMENT|run|${duration}|\n[/FITLOG]`;
  assert.throws(() => parseFitlog(clock("2000:00"), "lb", {}), /between 0 and 24 hours/);
  assert.equal(parseFitlog(clock("4:00"), "lb", {}).cardio[0]?.segments?.length, 1);
  assert.throws(() => parseFitlog(clock("4:5"), "lb", {}), /duration requires/);
  assert.throws(() => parseFitlog(clock("1:02:03"), "lb", {}), /duration requires/);
});

test("v107: FITLOG dispatch uses the first tag only, and prefix commands warn instead of vanishing", () => {
  const v1WithLaterV2Tag = `[FITLOG:1]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nDURATION|30\nNOTES|See [FITLOG:2] for later\n[/FITLOG]`;
  assert.throws(() => parseFitlog(v1WithLaterV2Tag, "lb", {}), /accepts FITLOG version 1/);
  const withModest = `[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nMODE|segments\nSEGMENT|run|4 min|\nMODEST|weird\n[/FITLOG]`;
  const warned = parseFitlog(withModest, "lb", {});
  assert.equal(warned.cardio[0]?.segments?.length, 1);
  assert.ok(warned.importWarnings?.some(warning => /unsupported field MODEST/.test(warning)), (warned.importWarnings ?? []).join(" | "));
});

test("v107: FITLOG v2 accepts repeats before MODE, sequential repeats, and rejects bad TYPE early", () => {
  const beforeMode = parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nREPEAT|2\nSEGMENT|run|4 min|\nENDREPEAT\nMODE|segments\n[/FITLOG]`, "lb", {});
  assert.equal(beforeMode.cardio[0]?.segments?.length, 2);
  const sequential = parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nTYPE|run\nMODE|segments\nREPEAT|2\nSEGMENT|run|4 min|\nENDREPEAT\nREPEAT|3\nSEGMENT|walk|1 min|\nENDREPEAT\n[/FITLOG]`, "lb", {});
  assert.equal(sequential.cardio[0]?.segments?.length, 5);
  assert.equal(new Set(sequential.cardio[0]?.segments?.map(segment => segment.groupId)).size, 2);
  assert.throws(() => parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nTYPE|bogus\nMODE|segments\nSEGMENT|run|4 min|\n[/FITLOG]`, "lb", {}), /TYPE: choose a supported activity/);
});

test("v107: FITLOG v2 fingerprints differ from v1, and mixed errors blame the CARDIO line", () => {
  const v1 = parseFitlog(`[FITLOG:1]\nWORKOUT|Run/walk|2026-01-15\nCARDIO|Run/walk session\nTYPE|run\nDURATION|40\n[/FITLOG]`, "lb", {});
  const v2 = parseFitlog(exampleFitlogV2(), "lb", {});
  assert.equal(v2.cardio[0]?.segments?.length, 13);
  assert.notEqual(v2.importFingerprint, v1.importFingerprint);
  assert.throws(() => parseFitlog(`[FITLOG:2]\nWORKOUT|Test|2026-01-15\nCARDIO|Run\nMODE|segments\nSEGMENT|run|4 min|\nSEGMENT|walk|1 min|\n[/FITLOG]`, "lb", {}), /Line 3: mixed run\/walk/);
});

test("v107: FITLOG examples use the prescribed move form", () => {
  assert.match(exampleFitlog(), /2 x 30 sec/);
  assert.doesNotMatch(exampleFitlog(), /30 sec\/side/);
  const v2 = parseFitlog(exampleFitlogV2(), "lb", {});
  assert.equal(v2.cardio[0]?.segments?.length, 13);
  assert.equal(v2.cardio[0]?.segments?.every(segment => segment.status === "unknown"), true);
});

test("v107: continuous runs keep the v105 completion path", () => {
  const planned = { ...makeCardio("run"), plannedDurationMin: 25, plannedDistanceKm: 5 };
  assert.equal(planned.segments, undefined);
  const done = completeActivity(planned);
  assert.equal(done.completed, true);
  assert.equal(done.actualDurationMin, 25);
  assert.equal(done.actualDistanceKm, 5);
  const typed = completeActivity({ ...planned, actualDurationMin: 22 });
  assert.equal(typed.actualDurationMin, 22);
});
