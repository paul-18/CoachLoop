import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendSegmentGroupIteration, completeActivity, segmentCountLabel, segmentPlanText } from "../app/domain/activity-segments";
import { defaultState, makeCardio, makeWorkout, type ActivitySegment } from "../app/domain/training-types";
import { prepareLoadedState } from "../app/persistence/migrations";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const seg = (id: string, kind: ActivitySegment["kind"], plannedDurationSec: number | null, extra: Partial<ActivitySegment> = {}): ActivitySegment => ({
  id, kind, plannedDurationSec, plannedDistanceM: null, actualDurationSec: null, actualDistanceM: null, status: "unknown", ...extra,
});

test("v111: plain words — stepper count labels and unlabeled plans never say part", () => {
  assert.equal(segmentCountLabel([seg("a", "run", 240), seg("b", "walk", 60)], "intervals"), "0 of 2 intervals done");
  assert.equal(segmentCountLabel([seg("a", "run", 240)], "rounds"), "0 of 1 rounds done");
  assert.equal(segmentCountLabel([seg("a", "run", 240)], "sets"), "0 of 1 sets done");
  // The legacy default stays for coach export and history, which are not steppers.
  assert.equal(segmentCountLabel([seg("a", "run", 240)]), "0 of 1 intervals done");
  assert.equal(segmentPlanText(seg("a", "other", null)), "Interval");
  assert.equal(segmentPlanText(seg("a", "other", 300, { label: "Push-ups x15" })), "Push-ups x15 · 5 min");
});

test("v111: plain words — no user-visible stepper string literal still contains part", () => {
  // Guard for Paul's "Idk what parts mean": every string literal inside the two
  // steppers is user-visible text (or a class list, which is skipped because it
  // contains "stepper-"). Code identifiers are not literals, so they cannot trip
  // this; rendered text and aria labels are covered by the v111 journeys.
  const src = readFileSync(join(root, "app/views/workout-editor.tsx"), "utf8");
  const body = src.slice(src.indexOf("function GroupedActivityStepper"), src.indexOf("function CardioEditor"));
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const withoutClasses = withoutComments.replace(/className="[^"]*"/g, "").replace(/className=\{`[^`]*`\}/g, "");
  const literals = [...withoutClasses.matchAll(/"([^"]*)"|`([^`]*)`|'([^']*)'/g)].map(match => match[1] ?? match[2] ?? match[3] ?? "");
  const offending = literals.filter(literal => !literal.includes("stepper-") && /part/i.test(literal));
  assert.deepEqual(offending, [], `stepper literals must not contain "part": ${offending.join(" | ")}`);
});

test("v111: one-tap repeat appends exactly one iteration cloned from the first iteration", () => {
  const segments = [
    seg("p1", "other", null, { label: "Push-ups x15", groupId: "g", iteration: 1 }),
    seg("s1", "other", null, { label: "Goblet squat x12", groupId: "g", iteration: 1 }),
    seg("p2", "other", null, { label: "Push-ups x15", groupId: "g", iteration: 2 }),
    seg("s2", "other", null, { label: "Goblet squat x12", groupId: "g", iteration: 2 }),
    seg("u", "run", 600),
  ];
  const next = appendSegmentGroupIteration(segments, "g");
  assert.equal(next.length, segments.length + 2, "one iteration appended");
  assert.deepEqual(next.slice(0, 5), segments, "pattern and ungrouped rows untouched");
  const added = next.slice(5);
  assert.deepEqual(added.map(s => s.iteration), [3, 3], "new iteration number follows the last");
  assert.ok(added.every(s => s.groupId === "g" && s.status === "unknown" && s.actualDurationSec === null && s.actualDistanceM === null), "copies start unknown with no actuals");
  assert.deepEqual(added.map(s => s.label), ["Push-ups x15", "Goblet squat x12"], "labels cloned from the first iteration");
  assert.ok(added.every(s => !segments.some(old => old.id === s.id)), "fresh ids");
  assert.throws(() => appendSegmentGroupIteration(segments, "missing"), /no segments to repeat/);
});

test("v111: routine roundsDone is optional, survives load, and completing keeps it", () => {
  // Old-shape activity without the field loads fine.
  const state = defaultState();
  const workout = makeWorkout("lb", 60, "Old shape QC");
  const oldCircuit = makeCardio("circuit");
  oldCircuit.name = "Garage circuit";
  workout.cardio = [oldCircuit];
  state.workouts = [workout];
  const loaded = prepareLoadedState(structuredClone(state));
  assert.equal((loaded.workouts[0].cardio[0] as { roundsDone?: number }).roundsDone, undefined, "old shape loads without the field");

  // New-shape activity round-trips through the loader.
  const newState = defaultState();
  const newWorkout = makeWorkout("lb", 60, "New shape QC");
  const circuit = makeCardio("circuit");
  circuit.name = "Garage circuit";
  circuit.roundsDone = 3;
  newWorkout.cardio = [circuit];
  newState.workouts = [newWorkout];
  const reloaded = prepareLoadedState(structuredClone(newState));
  assert.equal(reloaded.workouts[0].cardio[0].roundsDone, 3, "roundsDone survives load");

  // Completing the activity keeps the count (spread, not rebuilt).
  const done = completeActivity({ ...circuit, completed: false });
  assert.equal(done.completed, true, "activity completes");
  assert.equal(done.roundsDone, 3, "rounds count kept on completion");
});
