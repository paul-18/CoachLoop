import assert from "node:assert/strict";
import test from "node:test";
import { completeAllRemainingSegments, previewSegmentLines, repeatedSegments, resolveUnknownSegments, segmentLabelError, segmentMeasure, segmentPlanText } from "../app/domain/activity-segments";
import { moveBlock, moveBlockLater } from "../app/domain/training-workflow";
import { defaultState, localDate, makeCardio, makeExercise, makeWorkout, type ActivitySegment, type CardioEntry } from "../app/domain/training-types";
import { parseBackup, serializeBackup } from "../app/persistence/backup-tools";
import { parseBackupActivitiesV105 } from "./fixtures/v105-activity-gate";
import { parseBackupReview as parseBackupReviewV105Settings } from "./fixtures/v105-settings-gate";
import { workoutToText } from "../app/interchange/coach-export";

const seg = (id: string, kind: "run" | "walk" | "rest" | "other", plannedDurationSec: number | null, extra: Partial<ActivitySegment> = {}): ActivitySegment => ({
  id, kind, plannedDurationSec, plannedDistanceM: null, actualDurationSec: null, actualDistanceM: null, status: "unknown", ...extra,
});

test("v108: moveBlock swaps adjacent entries in normalized order, never the arrays", () => {
  const workout = makeWorkout("lb", 60, "Mixed");
  const ex1 = workout.exercises[0]!;
  const ex2 = makeExercise("lb", 60, "Second");
  const run = makeCardio("run"); run.name = "Run";
  workout.exercises = [ex1, ex2];
  workout.cardio = [run];
  workout.blockOrder = [{ type: "exercise", id: ex1!.id }, { type: "activity", id: run.id }, { type: "exercise", id: ex2!.id }];
  const up = moveBlock(workout, run.id, "up");
  assert.deepEqual(up.blockOrder.map(b => b.id), [run.id, ex1!.id, ex2!.id]);
  assert.deepEqual(up.exercises.map(e => e.id), [ex1!.id, ex2!.id], "exercises[] untouched");
  assert.deepEqual(up.cardio.map(c => c.id), [run.id], "cardio[] untouched");
  const down = moveBlock(up, run.id, "down");
  assert.deepEqual(down.blockOrder.map(b => b.id), [ex1!.id, run.id, ex2!.id]);
  assert.equal(moveBlock(workout, ex1!.id, "up"), workout, "first block up is a no-op (same reference)");
  assert.equal(moveBlock(workout, ex2!.id, "down"), workout, "last block down is a no-op");
  const later = moveBlockLater(workout, run.id);
  assert.deepEqual(later.blockOrder.map(b => b.id), [ex1!.id, ex2!.id, run.id]);
});

test("v108: moveBlock repairs missing entries exactly like moveBlockLater, then swaps", () => {
  const workout = makeWorkout("lb", 60, "Missing");
  const [ex1] = workout.exercises;
  const run = makeCardio("run");
  workout.cardio = [run];
  workout.blockOrder = [];
  const moved = moveBlock(workout, run.id, "up");
  assert.deepEqual(moved.blockOrder, [{ type: "activity", id: run.id }, { type: "exercise", id: ex1!.id }], "missing entries repaired exercises-then-cardio, then swapped");
  const dropped = moveBlock({ ...workout, blockOrder: [{ type: "exercise", id: "ghost" }, { type: "exercise", id: ex1!.id }, { type: "activity", id: run.id }] }, run.id, "up");
  assert.deepEqual(dropped.blockOrder.map(b => b.id), [run.id, ex1!.id], "invalid entries do not survive a swap");
});

test("v108: segmentPlanText prefers labels and formats measures", () => {
  assert.equal(segmentPlanText(seg("a", "run", 240)), "Run 4 min");
  assert.equal(segmentPlanText(seg("a", "walk", 60)), "Walk 1 min");
  assert.equal(segmentPlanText(seg("a", "run", 30)), "Run 30 sec");
  assert.equal(segmentPlanText(seg("a", "run", 600, { plannedDistanceM: 2000 })), "Run 10 min · 2 km");
  assert.equal(segmentPlanText(seg("a", "run", 600, { plannedDistanceM: 500 })), "Run 10 min · 500 m");
  assert.equal(segmentPlanText(seg("a", "rest", 60)), "Rest 1 min");
  assert.equal(segmentPlanText(seg("a", "other", null, { label: "Push-ups x15" })), "Push-ups x15");
  assert.equal(segmentPlanText(seg("a", "run", 600, { label: "Tempo" })), "Tempo · 10 min");
  assert.equal(segmentPlanText(seg("a", "rest", 60, { plannedDistanceM: 500 })), "Rest 1 min", "rest distance never shown");
});

test("v108: labels reject pipes and newlines", () => {
  assert.equal(segmentLabelError("Tempo"), null);
  assert.equal(segmentLabelError("Push-ups x15"), null);
  assert.equal(segmentLabelError("A|B"), "Labels cannot contain |.");
  assert.match(segmentLabelError("A\nB") ?? "", /line breaks/);
});

test("v108: preview lines list parts and collapse groups with labels", () => {
  const segments = [
    seg("a", "run", 240, { groupId: "g", iteration: 1 }),
    seg("b", "walk", 60, { groupId: "g", iteration: 1 }),
    seg("c", "run", 240, { groupId: "g", iteration: 2 }),
    seg("d", "walk", 60, { groupId: "g", iteration: 2 }),
    seg("e", "run", 600, { label: "Tempo" }),
  ];
  assert.deepEqual(previewSegmentLines(segments), ["Repeat 2x: Run 4 min + Walk 1 min", "Tempo · 10 min"]);
});

test("v108: repeat preserves labels on copies", () => {
  const copies = repeatedSegments([seg("a", "other", null, { label: "Freestyle" })], 2);
  assert.equal(copies.length, 2);
  assert.equal(copies[0]?.label, "Freestyle");
  assert.equal(copies[1]?.label, "Freestyle");
  assert.equal(copies[0]?.groupId, copies[1]?.groupId);
  assert.equal(copies[0]?.iteration, 1);
  assert.equal(copies[1]?.iteration, 2);
});

test("v108: complete-all resolves unknowns, keeps skips skipped", () => {
  const segments = [
    seg("a", "run", 240),
    seg("b", "walk", 60, { actualDurationSec: 70 }),
    seg("c", "run", 240, { status: "skipped" as const }),
  ];
  const done = completeAllRemainingSegments(segments);
  assert.equal(done[0]?.status, "completed");
  assert.equal(done[1]?.status, "modified");
  assert.equal(done[2]?.status, "skipped");
  assert.deepEqual(resolveUnknownSegments(segments).map(s => s.status), ["completed", "modified", "skipped"]);
});

test("v108: modified-without-actual contributes nothing for the missing measure", () => {
  const activity: CardioEntry = { ...makeCardio("run"), name: "Run", segments: [
    seg("a", "run", 300, { status: "modified" as const, actualDurationSec: 280 }),
  ] };
  const duration = segmentMeasure(activity, "duration");
  const distance = segmentMeasure(activity, "distance");
  assert.equal(duration?.value, 280);
  assert.equal(duration?.fullyRecorded, true);
  assert.equal(distance?.value, null, "no distance actual means no distance value, never the planned distance");
  assert.equal(distance?.fullyRecorded, false);
});

test("v108: old backup without labels imports unchanged; new labeled backup round-trips labels", () => {
  const oldState = defaultState();
  const workout = makeWorkout("lb", 60, "Old");
  const run: CardioEntry = { ...makeCardio("run"), name: "Run", segments: [seg("a", "run", 240)] };
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: "activity", id: run.id }];
  oldState.workouts = [workout];
  const parsedOld = parseBackup(serializeBackup(oldState));
  assert.equal(parsedOld.workouts[0]?.cardio[0]?.segments?.[0]?.label, undefined);
  assert.equal(parsedOld.workouts[0]?.cardio[0]?.segments?.[0]?.plannedDurationSec, 240);

  const newState = defaultState();
  const workout2 = makeWorkout("lb", 60, "New");
  const run2: CardioEntry = { ...makeCardio("run"), name: "Run", segments: [seg("a", "run", 600, { label: "Tempo" })] };
  workout2.exercises = []; workout2.cardio = [run2]; workout2.blockOrder = [{ type: "activity", id: run2.id }];
  newState.workouts = [workout2];
  const text = serializeBackup(newState);
  const parsedNew = parseBackup(text);
  assert.equal(parsedNew.workouts[0]?.cardio[0]?.segments?.[0]?.label, "Tempo");
  // v105 gate: walk-free backup passes; labeled segments survive verbatim (passthrough).
  const v105 = parseBackupActivitiesV105(text);
  const seg0 = (v105.activities[0] as { segments?: ActivitySegment[] }).segments?.[0];
  assert.equal(seg0?.label, "Tempo");
  assert.equal(seg0?.plannedDurationSec, 600);
  parseBackupReviewV105Settings(text);
});

test("v108: v105 settings gate still rejects a walk-storing backup", () => {
  const state = defaultState();
  state.settings = { ...state.settings, quickLogActivities: ["run", "walk"] as never };
  assert.throws(() => parseBackupActivitiesV105(serializeBackup(state)), /quickLogActivities/);
});

test("v108: coach export renders labels and keeps as-prescribed labeling", () => {
  const activity: CardioEntry = { ...makeCardio("run"), name: "Run", segments: [
    seg("a", "run", 600, { label: "Tempo", status: "completed" as const }),
    seg("b", "walk", 60, { status: "modified" as const, actualDurationSec: 70 }),
  ], completed: true, completedAsPlanned: false };
  const workout = { ...makeWorkout("lb", 60, "Export"), date: localDate(), status: "completed" as const, exercises: [], cardio: [activity], blockOrder: [{ type: "activity" as const, id: activity.id }] };
  const text = workoutToText(workout);
  assert.match(text, /Tempo/);
  assert.match(text, /as prescribed/);
  assert.match(text, /measured/);
});

test("v108: 'Edit detail' appears nowhere in app source", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const walk = async (dir: string): Promise<string[]> => {
    const out: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await walk(path));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
    }
    return out;
  };
  const files = await walk(new URL("../app", import.meta.url).pathname);
  for (const file of files) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /Edit detail/, file);
  }
});
