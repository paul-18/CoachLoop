import assert from "node:assert/strict";
import test from "node:test";
import { parseFitlog, exampleFitlog, FITLOG_INSTRUCTIONS, FITLOG_REMINDER } from "../app/interchange/fitlog";
import { completedSetValues } from "../app/domain/completion";
import { makeSet } from "../app/domain/training-types";

const block = (lines: string) => `[FITLOG:1]\nWORKOUT|Training|2026-10-02\n${lines}\n[/FITLOG]`;

test("rep ranges require actual reps while exact prescriptions stay one-tap", () => {
  const set = makeSet("lb", { plannedReps: "6-8", plannedWeight: 185 });
  assert.throws(() => completedSetValues(set), /Enter the reps you performed/);
  assert.throws(() => completedSetValues({ ...set, actualReps: "6-8" }), /Enter the reps/);
  assert.throws(() => completedSetValues({ ...set, actualReps: "0" }), /Enter the reps/);
  assert.throws(() => completedSetValues({ ...set, actualReps: "6.5" }), /Enter the reps/);
  // Outside the target is still an honest actual, rather than a validation failure.
  assert.equal(completedSetValues({ ...set, actualReps: "5" }).actualReps, "5");
  assert.equal(completedSetValues({ ...set, actualReps: "9" }).actualWeight, 185);
  assert.equal(completedSetValues({ ...set, plannedReps: "6" }).actualReps, "6");
  assert.equal(set.actualReps, "");
});

test("import errors identify the original line, exercise and set", () => {
  const text = "Coach intro\n\n[FITLOG:1]\nWORKOUT|Training|2026-10-02\n\nEXERCISE|Bench press\nSET|6|185 lb total|RIR 2\nSET|6|185|RIR 2\n[/FITLOG]";
  assert.throws(() => parseFitlog(text, "lb", {}), /Line 8 · Bench press, set 2: SET: use Bodyweight or a load/);
  assert.throws(() => parseFitlog(block("DURATION|30\nCARDIO|Run\nTYPE|run"), "lb", {}), /Line 3: DURATION: this field is outside/);
  assert.throws(() => parseFitlog(block("EXERCISE|Bench press\nSET||185 lb total|RIR 2"), "lb", {}), /Bench press, set 1.*rep target/);
  assert.throws(() => parseFitlog(block("EXERCISE|Bench press\nSET|6|185 lb total|RIR 2|pause"), "lb", {}), /Put instructions on a NOTES line/);
});

test("explicit load meanings import cleanly while old ambiguous loads stay compatible with warnings", () => {
  for (const [name, load, mode] of [["Bench press", "185 lb total", "total"], ["Dumbbell press", "40 lb each", "per_hand"], ["Weighted pull-up", "25 lb added", "added"]]) {
    const workout = parseFitlog(block(`EXERCISE|${name}\nSET|6|${load}|RIR 2`), "lb", {});
    assert.equal(workout.exercises[0].sets[0].weightMode, mode);
    assert.equal(workout.importWarnings?.length, 0);
  }
  const old = parseFitlog(block("EXERCISE|Dumbbell press\nSET|6|40 lb|RIR 2"), "lb", {});
  assert.equal(old.exercises[0].sets[0].plannedWeight, 40);
  assert.match(old.importWarnings![0], /Line 4 · Dumbbell press, set 1.*per hand/);
  assert.equal(parseFitlog(exampleFitlog, "lb", {}).importWarnings?.length, 0);
  assert.throws(() => parseFitlog(block("EXERCISE|Assisted pull-up\nSET|6|Bodyweight - 20 lb|RIR 2"), "lb", {}), /SET: use Bodyweight/);
});

test("unsupported fields and misplaced workout notes are visible instead of silently dropped", () => {
  const workout = parseFitlog(block("NOTES|Session guidance\nEXERCISE|Bench press\nSET|6|185 lb total|RIR 2\nTEMPO|3 seconds down"), "lb", {});
  assert.equal(workout.importWarnings?.length, 2);
  assert.match(workout.importWarnings![0], /workout-level NOTES are not supported/);
  assert.match(workout.importWarnings![1], /Line 6: unsupported field TEMPO was ignored/);
  for (const instructions of [FITLOG_INSTRUCTIONS, FITLOG_REMINDER]) {
    assert.match(instructions, /FITLOG:1/);
    assert.match(instructions, /actual reps/);
    assert.match(instructions, /total/);
    assert.match(instructions, /each/);
    assert.match(instructions, /added/);
  }
});
