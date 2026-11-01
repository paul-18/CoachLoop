import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSegmentGroup,
  completeSegmentGroupIteration,
  resolveUnknownSegments,
  segmentCounts,
} from "../app/domain/activity-segments";
import type { ActivitySegment } from "../app/domain/training-types";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32). Fixed seeds only: no unseeded randomness
// and no wall-clock-dependent assertions anywhere in this file.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const intIn = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));
const chance = (rng: Rng, p: number): boolean => rng() < p;
const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)]!;

const ALLOWED_STATUSES = ["completed", "modified", "skipped", "unknown"] as const;
const KINDS = ["run", "walk", "rest", "other"] as const;
const LABELS = ["Push-ups x15", "Goblet squat x12", "Freestyle", ""] as const;

const clone = (segments: readonly ActivitySegment[]): ActivitySegment[] =>
  segments.map((s) => ({ ...s }));

/** Random grouped circuit/swim-shaped segments: 0–2 groups × 1–3 iterations × 1–3 stations, plus 0–2 ungrouped parts. */
function randomSegments(rng: Rng): ActivitySegment[] {
  const segments: ActivitySegment[] = [];
  let n = 0;
  const groups = intIn(rng, 0, 2);
  for (let g = 0; g < groups; g++) {
    const groupId = `g${g}`;
    const iterations = intIn(rng, 1, 3);
    for (let it = 1; it <= iterations; it++) {
      const stations = intIn(rng, 1, 3);
      for (let s = 0; s < stations; s++) {
        const kind = pick(rng, KINDS);
        const status = pick(rng, ALLOWED_STATUSES);
        segments.push({
          id: `s${n++}`, kind,
          label: pick(rng, LABELS) || undefined,
          plannedDurationSec: chance(rng, 0.5) ? intIn(rng, 20, 300) : null,
          actualDurationSec: chance(rng, 0.3) ? intIn(rng, 20, 300) : null,
          plannedDistanceM: chance(rng, 0.4) ? pick(rng, [50, 100, 200]) : null,
          actualDistanceM: chance(rng, 0.2) ? pick(rng, [50, 100, 200]) : null,
          status, groupId, iteration: it,
        });
      }
    }
  }
  const ungrouped = intIn(rng, 0, 2);
  for (let u = 0; u < ungrouped; u++) {
    segments.push({
      id: `s${n++}`, kind: pick(rng, KINDS),
      label: pick(rng, LABELS) || undefined,
      plannedDurationSec: chance(rng, 0.5) ? intIn(rng, 20, 300) : null,
      actualDurationSec: chance(rng, 0.3) ? intIn(rng, 20, 300) : null,
      plannedDistanceM: chance(rng, 0.4) ? pick(rng, [50, 100, 200]) : null,
      actualDistanceM: chance(rng, 0.2) ? pick(rng, [50, 100, 200]) : null,
      status: pick(rng, ALLOWED_STATUSES),
    });
  }
  return segments;
}

function checkInvariants(before: readonly ActivitySegment[], after: readonly ActivitySegment[], changedIds: Set<string>) {
  // Statuses stay in the allowed set; counts stay consistent.
  for (const s of after) assert.ok((ALLOWED_STATUSES as readonly string[]).includes(s.status), `status ${s.status} allowed`);
  const counts = segmentCounts(after);
  assert.equal(counts.done + counts.unknown + counts.skipped, counts.total, "done + unknown + skipped == total");
  assert.equal(after.length, before.length, "no parts added or dropped by completion helpers");
  // Completion helpers touch status only, never actuals or plans.
  for (let i = 0; i < before.length; i++) {
    assert.equal(after[i]!.actualDurationSec, before[i]!.actualDurationSec, "actual duration untouched");
    assert.equal(after[i]!.actualDistanceM, before[i]!.actualDistanceM, "actual distance untouched");
    assert.equal(after[i]!.plannedDurationSec, before[i]!.plannedDurationSec, "plan untouched");
  }
  // A part that changes unknown -> completed carried no typed actuals (prescribed, never measured).
  for (const s of after) {
    const prev = before.find((item) => item.id === s.id)!;
    if (prev.status === "unknown" && s.status === "completed") {
      assert.equal(s.actualDurationSec, null, "as-prescribed completion carries no typed duration");
      assert.equal(s.actualDistanceM, null, "as-prescribed completion carries no typed distance");
    }
    if (prev.status === "unknown" && s.status === "modified") {
      assert.ok(s.actualDurationSec != null || s.actualDistanceM != null, "Measured completion had typed actuals");
    }
  }
  // Only the expected ids changed.
  for (const s of after) {
    const prev = before.find((item) => item.id === s.id)!;
    if (prev.status !== s.status) assert.ok(changedIds.has(s.id), `only targeted parts change (${s.id})`);
  }
}

test("v109 randomized: per-iteration, whole-group, and complete-all preserve stepper invariants", () => {
  const rng = mulberry32(0x109109);
  const CASES = 400;
  for (let c = 0; c < CASES; c++) {
    let segments = randomSegments(rng);
    const actions = intIn(rng, 1, 6);
    for (let a = 0; a < actions; a++) {
      const before = clone(segments);
      const action = intIn(rng, 0, 3);
      const changed = new Set<string>();
      if (action === 0) {
        // Per-iteration Done (one round / one set).
        const grouped = before.filter((s) => s.groupId);
        if (!grouped.length) continue;
        const target = pick(rng, grouped);
        for (const s of before) {
          if (s.groupId === target.groupId && (s.iteration ?? null) === (target.iteration ?? null) && s.status === "unknown") changed.add(s.id);
        }
        segments = completeSegmentGroupIteration(before, target.groupId!, target.iteration ?? null);
        // Skips never auto-complete: every previously skipped part stays skipped.
        for (const s of before.filter((item) => item.status === "skipped")) {
          assert.equal(segments.find((item) => item.id === s.id)!.status, "skipped", "skip survives per-iteration Done");
        }
      } else if (action === 1) {
        // Whole-group completion.
        const grouped = before.filter((s) => s.groupId);
        if (!grouped.length) continue;
        const target = pick(rng, grouped);
        for (const s of before) if (s.groupId === target.groupId && s.status === "unknown") changed.add(s.id);
        segments = completeSegmentGroup(before, target.groupId!);
      } else if (action === 2) {
        // Complete-all.
        for (const s of before) if (s.status === "unknown") changed.add(s.id);
        segments = resolveUnknownSegments(before);
      } else {
        // Explicit skip of one unknown part (the only way a skip appears).
        const open = before.filter((s) => s.status === "unknown");
        if (!open.length) continue;
        const target = pick(rng, open);
        changed.add(target.id);
        segments = before.map((s) => (s.id === target.id ? { ...s, status: "skipped" as const } : s));
        // Skip action changes exactly one part.
        checkInvariants(before, segments, changed);
        continue;
      }
      checkInvariants(before, segments, changed);
      // Skips never auto-complete under any completion action.
      for (const s of before.filter((item) => item.status === "skipped")) {
        assert.equal(segments.find((item) => item.id === s.id)!.status, "skipped", "skip survives completion actions");
      }
    }
  }
});
