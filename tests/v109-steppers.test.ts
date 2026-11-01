import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSegmentGroup,
  completeSegmentGroupIteration,
  resolveUnknownSegments,
  segmentCounts,
  segmentUnits,
} from "../app/domain/activity-segments";
import type { ActivitySegment } from "../app/domain/training-types";

const seg = (id: string, extra: Partial<ActivitySegment> = {}): ActivitySegment => ({
  id, kind: "other", plannedDurationSec: null, plannedDistanceM: null,
  actualDurationSec: null, actualDistanceM: null, status: "unknown", ...extra,
});

/** Two circuit rounds (shared groupId, iterations 1–2) plus one ungrouped station, in stored order. */
const circuit = (): ActivitySegment[] => [
  seg("p1", { label: "Push-ups x15", groupId: "g", iteration: 1 }),
  seg("s1", { label: "Goblet squat x12", groupId: "g", iteration: 1 }),
  seg("r1", { kind: "rest", plannedDurationSec: 20, groupId: "g", iteration: 1 }),
  seg("p2", { label: "Push-ups x15", groupId: "g", iteration: 2 }),
  seg("s2", { label: "Goblet squat x12", groupId: "g", iteration: 2 }),
  seg("r2", { kind: "rest", plannedDurationSec: 20, groupId: "g", iteration: 2 }),
  seg("w", { label: "Warm-up", }),
];

test("v109: segmentUnits groups one REPEAT iteration per unit, in stored order, ungrouped last as its own unit", () => {
  const units = segmentUnits(circuit());
  assert.equal(units.length, 3, "two rounds + one ungrouped unit");
  assert.deepEqual(units[0]!.segments.map(s => s.id), ["p1", "s1", "r1"]);
  assert.deepEqual(units[1]!.segments.map(s => s.id), ["p2", "s2", "r2"]);
  assert.equal(units[0]!.groupId, "g");
  assert.equal(units[0]!.iteration, 1);
  assert.equal(units[1]!.iteration, 2);
  assert.equal(units[2]!.groupId, null);
  assert.deepEqual(units[2]!.segments.map(s => s.id), ["w"]);
});

test("v109: segmentUnits keeps an ungrouped segment interleaved before the rounds in position", () => {
  const segments = [seg("w"), ...circuit().slice(0, 6)];
  const units = segmentUnits(segments);
  assert.equal(units.length, 3);
  assert.equal(units[0]!.groupId, null);
  assert.equal(units[1]!.iteration, 1);
  assert.equal(units[2]!.iteration, 2);
});

test("v109: segmentUnits treats a groupId without iteration as one unit for the whole group", () => {
  const units = segmentUnits([seg("a", { groupId: "g" }), seg("b", { groupId: "g" })]);
  assert.equal(units.length, 1);
  assert.equal(units[0]!.iteration, null);
  assert.equal(units[0]!.segments.length, 2);
});

test("v109: completeSegmentGroupIteration completes only that round's unknown parts", () => {
  const segments = circuit();
  segments[1]!.status = "skipped"; // a skipped station in round 1 stays skipped
  const next = completeSegmentGroupIteration(segments, "g", 1);
  assert.deepEqual(next.slice(0, 3).map(s => s.status), ["completed", "skipped", "completed"]);
  assert.ok(next.slice(3, 6).every(s => s.status === "unknown"), "round 2 untouched");
  assert.equal(next[6]!.status, "unknown", "ungrouped untouched");
  assert.equal(segments[0]!.status, "unknown", "input not mutated");
});

test("v109: completeSegmentGroupIteration marks typed actuals Measured, others as prescribed", () => {
  const segments = circuit();
  segments[0]!.actualDurationSec = 45;
  const next = completeSegmentGroupIteration(segments, "g", 1);
  assert.equal(next[0]!.status, "modified", "typed actual becomes Measured");
  assert.equal(next[1]!.status, "completed", "no actual becomes as-prescribed");
  assert.equal(next[0]!.actualDurationSec, 45, "actuals preserved, not overwritten");
});

test("v109: per-iteration completion differs from whole-group completion", () => {
  const segments = circuit();
  const one = completeSegmentGroupIteration(segments, "g", 2);
  assert.ok(one.slice(0, 3).every(s => s.status === "unknown"), "round 1 untouched by round-2 Done");
  assert.ok(one.slice(3, 6).every(s => s.status === "completed"), "round 2 done");
  const whole = completeSegmentGroup(segments, "g");
  assert.ok(whole.slice(0, 6).every(s => s.status === "completed"), "whole-group helper still covers all iterations");
  assert.equal(whole[6]!.status, "unknown", "whole-group helper still skips ungrouped");
});

test("v109: counts stay consistent after a round Done (done + unknown + skipped == total)", () => {
  const segments = circuit();
  segments[4]!.status = "skipped";
  const next = completeSegmentGroupIteration(segments, "g", 1);
  const counts = segmentCounts(next);
  assert.equal(counts.done + counts.unknown + counts.skipped, counts.total);
  assert.equal(counts.done, 3);
  assert.equal(counts.skipped, 1);
  assert.equal(counts.unknown, 3);
});

test("v109: swim segmentUnits — one iteration = one set, ungrouped intervals stay individual", () => {
  const swim = [
    seg("f1", { label: "Freestyle", plannedDistanceM: 50, groupId: "s", iteration: 1 }),
    seg("f2", { label: "Freestyle", plannedDistanceM: 50, groupId: "s", iteration: 1 }),
    seg("f3", { label: "Freestyle", plannedDistanceM: 50, groupId: "s", iteration: 2 }),
    seg("c1", { label: "Cool-down", plannedDistanceM: 100 }),
  ];
  const units = segmentUnits(swim);
  assert.equal(units.length, 3);
  assert.deepEqual(units[0]!.segments.map(s => s.id), ["f1", "f2"]);
  assert.deepEqual(units[1]!.segments.map(s => s.id), ["f3"]);
  assert.equal(units[2]!.groupId, null);
  const done = completeSegmentGroupIteration(swim, "s", 1);
  assert.deepEqual(done.map(s => s.status), ["completed", "completed", "unknown", "unknown"]);
  assert.deepEqual(resolveUnknownSegments(done).map(s => s.status), ["completed", "completed", "completed", "completed"]);
});
