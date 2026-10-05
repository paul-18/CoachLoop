import assert from "node:assert/strict";
import test from "node:test";
import { FITLOG_INSTRUCTIONS, FITLOG_REMINDER, parseFitlog } from "../app/interchange/fitlog";
import { buildCoachPrompt } from "../app/interchange/coach-export";
import { defaultState, type CoachOptions } from "../app/domain/training-types";

const plan = `[FITLOG:1]
WORKOUT|Bench Strength and Shoulders|2026-10-05
EXERCISE|Barbell Bench Press
SET|5|135 lb total||WARMUP
SET|4|200 lb total|RPE 8
REST|180
NOTES|Pause briefly on the chest. No bounce.
EXERCISE|Pallof Press
SET|10|40 lb total|RPE 7
REST|45
NOTES|Perform 10 reps per side. Enter actual reps per side when logging.
[/FITLOG]`;

test("fenced multiline FITLOG imports; flattened and joined commands give actionable errors", () => {
  const parsed = parseFitlog("```text\n" + plan + "\n```", "lb", {});
  assert.equal(parsed.exercises.length, 2);
  assert.equal(parsed.exercises[1].sets[0].plannedReps, "10");
  assert.equal(parsed.exercises[0].sets[0].warmup, true);
  assert.equal(parsed.exercises[0].sets[1].completed, false);
  assert.doesNotThrow(() => parseFitlog(plan.replace("Bench Strength and Shoulders", "Strength and REST"), "lb", {}));
  for (const broken of [plan.replaceAll("\n", " "), plan.replace("EXERCISE|Barbell Bench Press\nSET|", "EXERCISE|Barbell Bench Press SET|")]) {
    assert.throws(() => parseFitlog(broken, "lb", {}), /Multiple FITLOG commands.*actual newline.*Copy button/);
  }
});

test("per-side text stays in notes; reps remain positive whole numbers or increasing ranges", () => {
  for (const reps of ["10 each side", "10/side", "10 reps", "0", "8-6", "2.5"]) {
    assert.throws(() => parseFitlog(plan.replace("SET|10|40", `SET|${reps}|40`), "lb", {}), /positive whole reps or an increasing range/);
  }
  assert.equal(parseFitlog(plan.replace("SET|10|40", "SET|8-10|40"), "lb", {}).exercises[1].sets[0].plannedReps, "8-10");
  // Pipes in free-text notes retain their existing precise validation error.
  assert.throws(() => parseFitlog(plan.replace("No bounce.", "No bounce. Use SET| notation in your next chat."), "lb", {}), /NOTES: expected 1 pipe-separated field/);
});

test("both brief modes and copied format carry output and unilateral rules; emphasis is per-brief", () => {
  const state = defaultState();
  const before = JSON.stringify(state);
  const options: CoachOptions = { mode: "new", days: 7, energy: "", sleep: "", soreness: "", restrictions: "", schedule: "", timeAvailable: "", equipment: "", request: "", emphasis: "Focus on technique today." };
  for (const mode of ["new", "continue"] as const) {
    const prompt = buildCoachPrompt(state, { ...options, mode }, "2026-10-05");
    assert.match(prompt, /ATHLETE NOTE — FOR THIS BRIEF ONLY\nFocus on technique today/);
    assert.match(prompt, /```text/);
    assert.match(prompt, /EVERY command on its own actual newline/);
    assert.match(prompt, /positive whole number or increasing range/);
    assert.match(prompt, /Enter actual reps per side when logging/);
  }
  for (const instructions of [FITLOG_INSTRUCTIONS, FITLOG_REMINDER]) assert.match(instructions, /entire corrected multiline block/);
  assert.doesNotMatch(buildCoachPrompt(state, { ...options, emphasis: "  " }, "2026-10-05"), /ATHLETE NOTE/);
  assert.equal(JSON.stringify(state), before);
});
