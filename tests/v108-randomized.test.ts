import assert from "node:assert/strict";
import test from "node:test";
import {
  completeAllRemainingSegments,
  completeSegmentGroup,
  repeatPatternError,
  repeatedSegments,
  resolveUnknownSegments,
  segmentCounts,
  segmentMeasure,
} from "../app/domain/activity-segments";
import { moveBlock } from "../app/domain/training-workflow";
import {
  makeCardio,
  makeExercise,
  makeWorkout,
  type ActivitySegment,
  type CardioEntry,
} from "../app/domain/training-types";

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
type Status = (typeof ALLOWED_STATUSES)[number];
const KINDS = ["run", "walk", "rest", "other"] as const;
type Kind = (typeof KINDS)[number];
const LABELS = ["Tempo", "Freestyle", "Push-ups x15", "Easy", "Hard", ""] as const;

const hasTypedActual = (s: ActivitySegment): boolean =>
  s.actualDurationSec != null || s.actualDistanceM != null;
const isDone = (s: ActivitySegment): boolean =>
  s.status === "completed" || s.status === "modified";
const cloneSegments = (segments: readonly ActivitySegment[]): ActivitySegment[] =>
  segments.map((s) => ({ ...s }));
const effectiveValue = (
  s: ActivitySegment,
  measure: "duration" | "distance",
): number | null | undefined =>
  s.status === "completed"
    ? measure === "duration"
      ? s.plannedDurationSec
      : s.plannedDistanceM
    : measure === "duration"
      ? s.actualDurationSec
      : s.actualDistanceM;

// ---------------------------------------------------------------------------
// Invariants, checked after initial generation and after EVERY action.
// ---------------------------------------------------------------------------
function assertInvariants(segments: readonly ActivitySegment[], ctx: string): void {
  // Statuses always in the allowed set; ids unique.
  for (const s of segments) {
    assert.ok(
      (ALLOWED_STATUSES as readonly string[]).includes(s.status),
      `${ctx}: status ${s.status} not allowed`,
    );
    if (s.groupId !== undefined) {
      assert.ok(
        Number.isInteger(s.iteration) && (s.iteration ?? 0) >= 1,
        `${ctx}: grouped part ${s.id} must carry an iteration`,
      );
    }
  }
  assert.equal(
    new Set(segments.map((s) => s.id)).size,
    segments.length,
    `${ctx}: segment ids must be unique`,
  );

  // Counts consistent, cross-checked against a manual recount.
  const counts = segmentCounts(segments);
  const manual = {
    done: segments.filter(isDone).length,
    total: segments.length,
    completed: segments.filter((s) => s.status === "completed").length,
    modified: segments.filter((s) => s.status === "modified").length,
    skipped: segments.filter((s) => s.status === "skipped").length,
    unknown: segments.filter((s) => s.status === "unknown").length,
  };
  assert.deepEqual(counts, manual, `${ctx}: segmentCounts must match a manual recount`);
  assert.equal(
    counts.done + counts.unknown + counts.skipped,
    counts.total,
    `${ctx}: done + unknown + skipped == total`,
  );
  assert.equal(
    counts.done,
    counts.completed + counts.modified,
    `${ctx}: done == completed + modified`,
  );

  // Measure invariants, recomputed from the parts (not trusted from helper).
  for (const measure of ["duration", "distance"] as const) {
    // segmentMeasure excludes rest parts from distance; mirror that exactly.
    const relevant = segments.filter(
      (s) => !(measure === "distance" && s.kind === "rest"),
    );
    const doneRelevant = relevant.filter(isDone);
    const before = cloneSegments(segments);
    const synthetic = { segments: [...segments] } as unknown as CardioEntry;
    const result = segmentMeasure(synthetic, measure);
    // The helper must not mutate its input.
    assert.deepEqual(synthetic.segments, before, `${ctx}: segmentMeasure must not mutate segments`);
    if (segments.length === 0) {
      assert.equal(result, null, `${ctx}: measure on an empty activity must be null`);
      continue;
    }
    assert.ok(result !== null, `${ctx}: measure must be non-null for a non-empty activity`);
    assert.equal(result.done, doneRelevant.length, `${ctx}: measure.done (${measure})`);
    assert.equal(result.total, relevant.length, `${ctx}: measure.total (${measure})`);
    if (doneRelevant.length === 0) {
      assert.equal(result.value, null, `${ctx}: no done parts => value null (${measure})`);
      assert.equal(result.fullyRecorded, false, `${ctx}: no done parts => not fully recorded`);
      assert.equal(result.inferred, false, `${ctx}: no done parts => not inferred`);
      assert.equal(result.measured, false, `${ctx}: no done parts => not measured`);
      continue;
    }
    const expectedMissing = doneRelevant.some((s) => effectiveValue(s, measure) == null);
    if (expectedMissing) {
      // Modified-without-actual contributes nothing; completed-without-plan
      // contributes nothing either. Never a planned fallback, never zero.
      assert.equal(result.value, null, `${ctx}: missing effective value => value null (${measure})`);
      assert.equal(result.fullyRecorded, false, `${ctx}: missing effective value => not fully recorded (${measure})`);
      // Inferred/measured label only the parts that actually contribute a
      // value when a value is missing; a part with no value labels nothing.
      const contributingCompleted = doneRelevant.some(
        (s) => s.status === "completed" && effectiveValue(s, measure) != null,
      );
      const contributingModified = doneRelevant.some(
        (s) => s.status === "modified" && effectiveValue(s, measure) != null,
      );
      assert.equal(result.inferred, contributingCompleted, `${ctx}: inferred labels contributing completed parts (${measure})`);
      assert.equal(result.measured, contributingModified, `${ctx}: measured labels contributing modified parts (${measure})`);
    } else {
      const expectedSum = doneRelevant.reduce(
        (sum, s) => sum + (effectiveValue(s, measure) as number),
        0,
      );
      assert.equal(result.value, expectedSum, `${ctx}: value is the sum of effective values (${measure})`);
      assert.equal(result.fullyRecorded, true, `${ctx}: no missing value => fully recorded (${measure})`);
      // With nothing missing, the literal rule holds exactly.
      assert.equal(
        result.inferred,
        doneRelevant.some((s) => s.status === "completed"),
        `${ctx}: inferred iff some done part is completed (${measure})`,
      );
      assert.equal(
        result.measured,
        doneRelevant.some((s) => s.status === "modified"),
        `${ctx}: measured iff some done part is modified (${measure})`,
      );
    }
  }
}

function assertSkipsPreserved(
  before: readonly ActivitySegment[],
  after: readonly ActivitySegment[],
  exemptIds: ReadonlySet<string>,
  ctx: string,
): void {
  const afterById = new Map(after.map((s) => [s.id, s]));
  for (const s of before) {
    if (s.status !== "skipped" || exemptIds.has(s.id)) continue;
    const next = afterById.get(s.id);
    if (next === undefined) continue; // removed by an explicit Remove action
    assert.equal(next.status, "skipped", `${ctx}: skipped part ${s.id} must never be auto-completed`);
  }
}

function assertStatusesUnchangedExcept(
  before: readonly ActivitySegment[],
  after: readonly ActivitySegment[],
  changedIds: ReadonlySet<string>,
  ctx: string,
): void {
  const afterById = new Map(after.map((s) => [s.id, s]));
  for (const s of before) {
    if (changedIds.has(s.id)) continue;
    const next = afterById.get(s.id);
    if (next === undefined) continue; // removed by an explicit Remove/Repeat action
    assert.equal(next.status, s.status, `${ctx}: untouched part ${s.id} must keep its status`);
  }
}

// Random part generator (deterministic ids within a case).
function randomPart(
  rng: Rng,
  id: string,
  groupId?: string,
  iteration?: number,
): ActivitySegment {
  const kind = pick(rng, KINDS) as Kind;
  const isRest = kind === "rest";
  const plannedDurationSec = chance(rng, 0.25) ? null : intIn(rng, 30, 1800);
  const plannedDistanceM = isRest || chance(rng, 0.4) ? null : intIn(rng, 100, 10000);
  const actualDurationSec = chance(rng, 0.6) ? null : intIn(rng, 30, 1800);
  const actualDistanceM = isRest || chance(rng, 0.6) ? null : intIn(rng, 100, 10000);
  const labelRoll = rng();
  const label =
    labelRoll < 0.3 ? undefined : labelRoll < 0.4 ? "" : pick(rng, LABELS);
  const status = pick(rng, [
    "unknown",
    "unknown",
    "completed",
    "modified",
    "skipped",
  ] as const) as Status;
  const part: ActivitySegment = {
    id,
    kind,
    plannedDurationSec,
    actualDurationSec,
    plannedDistanceM,
    actualDistanceM,
    status,
  };
  if (label !== undefined) part.label = label;
  if (groupId !== undefined) {
    part.groupId = groupId;
    part.iteration = iteration;
  }
  return part;
}

function generateCase(rng: Rng, caseIndex: number): ActivitySegment[] {
  let counter = 0;
  const nextId = (): string => `seg-${caseIndex}-${counter++}`;
  const segments: ActivitySegment[] = [];
  // 0-2 groups: pattern (1-3 parts) x iterations (1-3). Group members share
  // groupId + iteration; planned values are shared across iterations while
  // actuals/statuses vary per copy.
  const groupCount = intIn(rng, 0, 2);
  let groupedTotal = 0;
  const groupSizes: number[] = [];
  for (let g = 0; g < groupCount; g++) {
    const patternSize = intIn(rng, 1, 3);
    const iterations = intIn(rng, 1, 3);
    groupSizes.push(patternSize * iterations);
    groupedTotal += patternSize * iterations;
  }
  const ungroupedCount =
    groupedTotal === 0
      ? intIn(rng, 1, 24)
      : intIn(rng, 0, Math.max(0, 24 - groupedTotal));
  for (let i = 0; i < ungroupedCount; i++) segments.push(randomPart(rng, nextId()));
  let gIndex = 0;
  for (const size of groupSizes) {
    void size;
    const groupId = `group-${caseIndex}-${gIndex}`;
    // Re-derive pattern size / iterations from the stored total is not
    // possible, so regenerate the pattern here deterministically from the
    // same stream order: pattern parts are drawn first, then expanded.
    // (Pattern size and iteration count were already consumed above, so
    // instead build the group directly: pattern bases are fresh draws.)
    const patternSize = intIn(rng, 1, 3);
    const iterations = intIn(rng, 1, 3);
    const bases: ActivitySegment[] = [];
    for (let p = 0; p < patternSize; p++) bases.push(randomPart(rng, nextId()));
    for (let it = 1; it <= iterations; it++) {
      for (const base of bases) {
        const copy: ActivitySegment = {
          ...base,
          id: nextId(),
          groupId,
          iteration: it,
          actualDurationSec: chance(rng, 0.6) ? null : intIn(rng, 30, 1800),
          actualDistanceM:
            base.kind === "rest" || chance(rng, 0.6) ? null : intIn(rng, 100, 10000),
          status: pick(rng, [
            "unknown",
            "unknown",
            "completed",
            "modified",
            "skipped",
          ] as const) as Status,
        };
        segments.push(copy);
      }
    }
    gIndex++;
  }
  // Guard: never exceed 24 parts and never empty (group draws above can
  // overshoot the earlier estimate, so trim grouped tail if needed).
  if (segments.length > 24) segments.length = 24;
  if (segments.length === 0) segments.push(randomPart(rng, nextId()));
  return segments;
}

const ACTIONS = [
  "done-one",
  "did-different",
  "skip",
  "undo",
  "complete-all",
  "group-complete",
  "add",
  "remove",
  "repeat",
] as const;
type Action = (typeof ACTIONS)[number];

test("v108 randomized: 400 cases x 1-8 actions keep segment invariants", () => {
  const rng = mulberry32(0x1a2b3c4d);
  const CASES = 400;
  for (let caseIndex = 0; caseIndex < CASES; caseIndex++) {
    let segments = generateCase(rng, caseIndex);
    // Activity-level completion is modelled separately and must never be
    // touched by any part helper: helpers only ever receive segments.
    const activityCompleted = chance(rng, 0.5);
    const initialActivityCompleted = activityCompleted;
    const ctx0 = `case ${caseIndex} (initial)`;
    assertInvariants(segments, ctx0);
    assert.equal(activityCompleted, initialActivityCompleted, `${ctx0}: activity flag untouched`);

    const undoStack: ActivitySegment[][] = [];
    const actionCount = intIn(rng, 1, 8);
    for (let step = 0; step < actionCount; step++) {
      const action = pick(rng, ACTIONS) as Action;
      const ctx = `case ${caseIndex} step ${step} action ${action}`;
      const before = segments;
      const beforeById = new Map(before.map((s) => [s.id, s]));
      void beforeById;
      if (action !== "undo") undoStack.push(cloneSegments(before));
      try {
        switch (action) {
          case "done-one": {
            const unknowns = before.filter((s) => s.status === "unknown");
            if (unknowns.length === 0) break;
            const target = pick(rng, unknowns);
            const resolved: Status = hasTypedActual(target) ? "modified" : "completed";
            segments = before.map((s) =>
              s.id === target.id ? { ...s, status: resolved } : s,
            );
            assert.equal(
              segments.find((s) => s.id === target.id)?.status,
              resolved,
              `${ctx}: Done-one must resolve to ${resolved}`,
            );
            assertStatusesUnchangedExcept(before, segments, new Set([target.id]), ctx);
            break;
          }
          case "did-different": {
            const candidates = before.filter((s) => s.status !== "skipped");
            if (candidates.length === 0) break;
            const target = pick(rng, candidates);
            const actualDurationSec = intIn(rng, 30, 1800);
            const actualDistanceM =
              target.kind === "rest" || chance(rng, 0.5)
                ? null
                : intIn(rng, 100, 10000);
            // Set actuals, back to unknown, then resolve just that part:
            // typed actuals always resolve to modified. (Resolving via
            // resolveUnknownSegments here would wrongly resolve every
            // other unknown part too, so the single-part rule is applied
            // directly; complete-all covers the helper itself.)
            segments = before.map((s) =>
              s.id === target.id
                ? { ...s, actualDurationSec, actualDistanceM, status: "modified" as const }
                : s,
            );
            const after = segments.find((s) => s.id === target.id);
            assert.equal(after?.status, "modified", `${ctx}: Did-different must resolve to modified`);
            assert.equal(after?.actualDurationSec, actualDurationSec, `${ctx}: Did-different keeps typed actuals`);
            assertStatusesUnchangedExcept(before, segments, new Set([target.id]), ctx);
            break;
          }
          case "skip": {
            const candidates = before.filter((s) => s.status !== "skipped");
            if (candidates.length === 0) break;
            const target = pick(rng, candidates);
            segments = before.map((s) =>
              s.id === target.id ? { ...s, status: "skipped" as const } : s,
            );
            assertStatusesUnchangedExcept(before, segments, new Set([target.id]), ctx);
            break;
          }
          case "undo": {
            const snapshot = undoStack.pop();
            if (snapshot === undefined) break;
            segments = cloneSegments(snapshot);
            assert.deepEqual(segments, snapshot, `${ctx}: Undo must restore the previous snapshot`);
            break;
          }
          case "complete-all": {
            // Both names must agree; resolveUnknownSegments is the alias
            // source for completeAllRemainingSegments.
            const viaResolve = resolveUnknownSegments(before);
            const viaAlias = completeAllRemainingSegments(before);
            assert.deepEqual(
              viaAlias.map((s) => s.status),
              viaResolve.map((s) => s.status),
              `${ctx}: complete-all alias must match resolveUnknownSegments`,
            );
            segments = viaResolve;
            break;
          }
          case "group-complete": {
            const groupIds = [...new Set(before.map((s) => s.groupId).filter((g): g is string => g !== undefined))];
            if (groupIds.length === 0) {
              // No group: completing a nonexistent group must change nothing.
              segments = completeSegmentGroup(before, "no-such-group");
              assert.deepEqual(
                segments.map((s) => s.status),
                before.map((s) => s.status),
                `${ctx}: group-complete on a missing group must be a no-op`,
              );
              break;
            }
            const groupId = pick(rng, groupIds);
            segments = completeSegmentGroup(before, groupId);
            // Only unknown members of that group may change, and only to
            // completed/modified by the typed-actuals rule.
            for (const s of before) {
              const after = segments.find((x) => x.id === s.id)!;
              if (s.groupId === groupId && s.status === "unknown") {
                assert.equal(
                  after.status,
                  hasTypedActual(s) ? "modified" : "completed",
                  `${ctx}: group-complete resolution rule`,
                );
              } else {
                assert.equal(after.status, s.status, `${ctx}: group-complete must not touch part ${s.id}`);
              }
            }
            break;
          }
          case "add": {
            const fresh = randomPart(rng, `seg-${caseIndex}-add-${step}`);
            // Added parts always start unknown.
            fresh.status = "unknown";
            segments = [...before, fresh];
            assert.deepEqual(
              segments.slice(0, before.length),
              before,
              `${ctx}: Add must not change existing parts`,
            );
            break;
          }
          case "remove": {
            if (before.length <= 1) break;
            const index = intIn(rng, 0, before.length - 1);
            const removed = before[index]!;
            segments = before.filter((_, i) => i !== index);
            assert.deepEqual(
              segments.map((s) => s.id),
              before.filter((s) => s.id !== removed.id).map((s) => s.id),
              `${ctx}: Remove must drop exactly one part, in order`,
            );
            break;
          }
          case "repeat": {
            const eligible = before.filter(
              (s) =>
                s.status === "unknown" &&
                s.groupId === undefined &&
                s.actualDurationSec == null &&
                s.actualDistanceM == null,
            );
            if (eligible.length === 0) {
              // No eligible (unknown + ungrouped + no actuals) pattern.
              // The helper refuses only on status/actuals, not on
              // grouped-ness, so assert refusal only for a part the helper
              // actually refuses; if every part is an unknown grouped part
              // with no actuals, there is simply nothing repeatable here.
              const ineligible = before.find(
                (s) =>
                  s.status !== "unknown" ||
                  s.actualDurationSec != null ||
                  s.actualDistanceM != null,
              );
              if (ineligible !== undefined) {
                assert.notEqual(
                  repeatPatternError([ineligible]),
                  null,
                  `${ctx}: repeatPatternError must refuse a non-unknown / typed part`,
                );
              }
              segments = before;
              break;
            }
            const take = intIn(rng, 1, Math.min(3, eligible.length));
            const start = intIn(rng, 0, eligible.length - take);
            const pattern = eligible.slice(start, start + take);
            assert.equal(
              repeatPatternError(pattern),
              null,
              `${ctx}: repeatPatternError must accept an unknown ungrouped pattern with no actuals`,
            );
            const n = intIn(rng, 2, 4);
            const copies = repeatedSegments(pattern, n);
            assert.equal(copies.length, pattern.length * n, `${ctx}: repeatedSegments length`);
            const sharedGroup = copies[0]?.groupId;
            assert.ok(sharedGroup !== undefined, `${ctx}: repeated copies share a groupId`);
            assert.ok(copies.every((c) => c.groupId === sharedGroup), `${ctx}: repeated copies share one groupId`);
            assert.deepEqual(
              copies.map((c) => c.iteration),
              Array.from({ length: n }, (_, i) => pattern.map(() => i + 1)).flat(),
              `${ctx}: repeated copies carry iterations 1..n per round`,
            );
            for (let i = 0; i < copies.length; i++) {
              const copy = copies[i]!;
              const source = pattern[i % pattern.length]!;
              assert.equal(copy.status, "unknown", `${ctx}: repeated copies start unknown`);
              assert.equal(copy.actualDurationSec, null, `${ctx}: repeated copies null their actuals`);
              assert.equal(copy.actualDistanceM, null, `${ctx}: repeated copies null their actuals`);
              assert.equal(copy.plannedDurationSec, source.plannedDurationSec ?? null, `${ctx}: repeated copies keep planned duration`);
              assert.equal(copy.plannedDistanceM, source.plannedDistanceM ?? null, `${ctx}: repeated copies keep planned distance`);
              assert.equal(copy.label, source.label, `${ctx}: repeated copies keep labels`);
              assert.equal(copy.kind, source.kind, `${ctx}: repeated copies keep kind`);
              assert.ok(!before.some((s) => s.id === copy.id), `${ctx}: repeated copies get fresh ids`);
            }
            const firstIndex = before.findIndex((s) => s.id === pattern[0]!.id);
            const patternIds = new Set(pattern.map((s) => s.id));
            const kept = before.filter((s) => !patternIds.has(s.id));
            segments = [
              ...kept.slice(0, firstIndex),
              ...copies,
              ...kept.slice(firstIndex),
            ];
            // Survivors keep their statuses.
            assertStatusesUnchangedExcept(before, segments, patternIds, ctx);
            break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`${ctx} (before: ${JSON.stringify(before)}) threw: ${message}`);
      }
      // After EVERY action: invariants, activity flag, skips.
      assertInvariants(segments, ctx);
      assert.equal(
        activityCompleted,
        initialActivityCompleted,
        `${ctx}: changing part statuses must never change the activity-level completed flag`,
      );
      if (action !== "undo") {
        // Undo restores a snapshot by definition, so it is exempt: it can
        // legitimately un-skip a part that was skipped by the undone
        // action. Every other action must preserve pre-existing skips.
        // (Did-different never targets a skipped part and Skip only adds
        // a skip, so the strict rule holds for them too.)
        assertSkipsPreserved(before, segments, new Set(), ctx);
      }
    }
  }
});

test("v108 randomized: moveBlock invariants on 20 seeded block orders", () => {
  const rng = mulberry32(0x5eed5eed);
  for (let caseIndex = 0; caseIndex < 20; caseIndex++) {
    const ctx = `moveBlock case ${caseIndex}`;
    const exerciseCount = intIn(rng, 2, 5);
    const cardioCount = intIn(rng, 1, 3);
    const workout = makeWorkout("lb", 60, `Random ${caseIndex}`);
    const exercises = Array.from({ length: exerciseCount }, (_, i) =>
      makeExercise("lb", 60, `Exercise ${i}`),
    );
    const cardio = Array.from({ length: cardioCount }, () =>
      makeCardio(pick(rng, ["run", "walk", "bike"] as const)),
    );
    workout.exercises = exercises;
    workout.cardio = cardio;
    const blocks: Array<{ type: "exercise" | "activity"; id: string }> = [
      ...exercises.map((e) => ({ type: "exercise" as const, id: e.id })),
      ...cardio.map((c) => ({ type: "activity" as const, id: c.id })),
    ];
    // Fisher-Yates shuffle with the seeded RNG: interleaved ids.
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = intIn(rng, 0, i);
      [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
    }
    workout.blockOrder = blocks;
    const originalOrder = blocks.map((b) => b.id);
    const originalExerciseIds = exercises.map((e) => e.id);
    const originalCardioIds = cardio.map((c) => c.id);

    // Ends are no-ops returning the same workout reference.
    assert.equal(moveBlock(workout, originalOrder[0]!, "up"), workout, `${ctx}: first block up is a no-op`);
    assert.equal(moveBlock(workout, originalOrder[originalOrder.length - 1]!, "down"), workout, `${ctx}: last block down is a no-op`);
    // The no-ops must not mutate the workout.
    assert.deepEqual(workout.blockOrder.map((b) => b.id), originalOrder, `${ctx}: no-op must not mutate blockOrder`);

    // A random move: swap adjacent entries, keep the id set, keep the
    // exercises[]/cardio[] arrays untouched, then invert to restore.
    const index = intIn(rng, 0, originalOrder.length - 1);
    const direction = pick(rng, ["up", "down"] as const);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const moved = moveBlock(workout, originalOrder[index]!, direction);
    if (targetIndex < 0 || targetIndex >= originalOrder.length) {
      assert.equal(moved, workout, `${ctx}: move past an end is a no-op`);
      continue;
    }
    assert.notEqual(moved, workout, `${ctx}: an interior move returns a new workout`);
    const expected = [...originalOrder];
    [expected[index], expected[targetIndex]] = [expected[targetIndex]!, expected[index]!];
    assert.deepEqual(moved.blockOrder.map((b) => b.id), expected, `${ctx}: move must swap adjacent entries only`);
    assert.deepEqual(
      [...moved.blockOrder.map((b) => b.id)].sort(),
      [...originalOrder].sort(),
      `${ctx}: move must keep the same id set`,
    );
    assert.deepEqual(moved.exercises.map((e) => e.id), originalExerciseIds, `${ctx}: exercises[] untouched`);
    assert.deepEqual(moved.cardio.map((c) => c.id), originalCardioIds, `${ctx}: cardio[] untouched`);
    assert.deepEqual(workout.blockOrder.map((b) => b.id), originalOrder, `${ctx}: move must not mutate the source workout`);
    const inverse = direction === "up" ? "down" : "up";
    const restored = moveBlock(moved, originalOrder[index]!, inverse);
    assert.deepEqual(restored.blockOrder.map((b) => b.id), originalOrder, `${ctx}: move then its inverse restores the order`);
  }
});
