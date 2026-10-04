import assert from "node:assert/strict";
import test from "node:test";
import { FITLOG_INSTRUCTIONS, FITLOG_REMINDER, parseFitlog } from "../app/interchange/fitlog";
import { buildCoachPrompt } from "../app/interchange/coach-export";
import { defaultState } from "../app/domain/training-types";

test("guided unilateral SET example imports numeric reps and retains per-side instructions as coach notes", () => {
  const text = "[FITLOG:1]\nWORKOUT|Synthetic unilateral test|2026-10-04\nEXERCISE|Pallof Press\nSET|10|10 lb total|RPE 7\nREST|45\nNOTES|Perform 10 reps per side. Enter actual reps per side when logging.\n[/FITLOG]";
  const workout = parseFitlog(text, "lb", {});
  assert.equal(workout.exercises[0].sets[0].plannedReps, "10");
  assert.equal(workout.exercises[0].sets[0].actualReps, "");
  assert.match(workout.exercises[0].coachNotes, /10 reps per side/);
  assert.equal(workout.exercises[0].sets[0].completed, false);
  for (const annotated of ["10 each side", "10/side", "10 sec"]) {
    assert.throws(() => parseFitlog(text.replace("SET|10|", `SET|${annotated}|`), "lb", {}), /rep target/);
  }
});

test("both coaching brief modes carry numeric-only and per-side guidance without changing the log", () => {
  const state = defaultState(), before = structuredClone(state);
  for (const mode of ["new", "continue"] as const) {
    const prompt = buildCoachPrompt(state, { mode, days: 7, energy: "", sleep: "", soreness: "", timeAvailable: "", equipment: "", restrictions: "", schedule: "", request: "" });
    assert.ok(prompt.includes(mode === "new" ? FITLOG_INSTRUCTIONS : FITLOG_REMINDER));
    assert.match(prompt, /positive whole number or increasing range/);
    assert.match(prompt, /10 reps per side/);
    assert.match(prompt, /SET\|10\|10 lb total\|RPE 7/);
  }
  assert.deepEqual(state, before);
});
