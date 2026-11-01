import assert from "node:assert/strict";
import test from "node:test";
import { exampleFitlogV3, FITLOG_V3_INSTRUCTIONS, FITLOG_V3_REMINDER, parseFitlog } from "../app/interchange/fitlog";
import { buildCoachPrompt, DEFAULT_COACH_PROFILE, NEW_COACH_PROFILE_PARAGRAPH, workoutToText } from "../app/interchange/coach-export";
import { defaultState } from "../app/domain/training-types";

const v3 = (body: string) => `[FITLOG:3]\nWORKOUT|Synthetic v110 test|2026-11-01\n${body}\n[/FITLOG]`;
const v2 = (body: string) => `[FITLOG:2]\nWORKOUT|Synthetic v110 test|2026-11-01\n${body}\n[/FITLOG]`;
const v1 = (body: string) => `[FITLOG:1]\nWORKOUT|Synthetic v110 test|2026-11-01\n${body}\n[/FITLOG]`;

test("v110: v3 labeled segments parse, including REPEAT-built groups with shared groupId and iteration", () => {
  const workout = parseFitlog(v3(`CARDIO|Garage circuit
TYPE|circuit
MODE|segments
DURATION|20
REPEAT|4
SEGMENT|other|||Push-ups x15
SEGMENT|other|||Goblet squat x12
SEGMENT|rest|20 sec||
ENDREPEAT`), "lb", {});
  const segments = workout.cardio[0].segments ?? [];
  assert.equal(segments.length, 12);
  assert.deepEqual(segments.map((segment) => segment.label), ["Push-ups x15", "Goblet squat x12", undefined, "Push-ups x15", "Goblet squat x12", undefined, "Push-ups x15", "Goblet squat x12", undefined, "Push-ups x15", "Goblet squat x12", undefined]);
  assert.deepEqual(segments.map((segment) => segment.iteration), [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  assert.equal(new Set(segments.map((segment) => segment.groupId)).size, 1);
  assert.equal(workout.cardio[0].plannedDurationMin, 20);
});

test("v110: v3 accepts the 4-field form, rejects a 6th field, and rejects a label containing |", () => {
  const plain = parseFitlog(v3(`CARDIO|Run
TYPE|run
MODE|segments
SEGMENT|run|4 min|
SEGMENT|walk|1 min|`), "lb", {});
  assert.equal(plain.cardio[0].segments?.length, 2);
  assert.equal(plain.cardio[0].segments?.[0].label, undefined);
  assert.throws(() => parseFitlog(v3(`CARDIO|Run
TYPE|run
MODE|segments
SEGMENT|run|4 min||Tempo|extra|`), "lb", {}), /SEGMENT expects kind\|duration\|distance\|optional label/);
  assert.throws(() => parseFitlog(v3(`CARDIO|Circuit
TYPE|circuit
MODE|segments
SEGMENT|other|||Push-ups|x15`), "lb", {}), /SEGMENT expects kind\|duration\|distance\|optional label/);
});

test("v110: v3 rejects SEGMENT lines in post-session types and mobility with exact messages", () => {
  const yoga = v3(`CARDIO|Yoga flow
TYPE|yoga
MODE|segments
SEGMENT|other|5 min|`);
  assert.throws(() => parseFitlog(yoga, "lb", {}), (error: unknown) => error instanceof Error && error.message === "Yoga is recorded after the session: use MODE|summary with DURATION and NOTES, not SEGMENT lines.");
  for (const [type, display] of [["grappling", "Grappling"], ["soccer", "Soccer"], ["water_polo", "Water polo"]] as const) {
    const block = v3(`CARDIO|Session
TYPE|${type}
MODE|segments
SEGMENT|other|5 min|`);
    assert.throws(() => parseFitlog(block, "lb", {}), (error: unknown) => error instanceof Error && error.message === `${display} is recorded after the session: use MODE|summary with DURATION and NOTES, not SEGMENT lines.`);
  }
  const mobility = v3(`MOBILITY|Stretch
MODE|segments
SEGMENT|other|60 sec|`);
  assert.throws(() => parseFitlog(mobility, "lb", {}), /Mobility uses MOVE lines, not SEGMENT lines/);
});

test("v110: v3 rejection catches REPEAT-built segments in post-session types", () => {
  const block = v3(`CARDIO|Rolling
TYPE|grappling
MODE|segments
REPEAT|2
SEGMENT|other|5 min|
SEGMENT|rest|1 min|
ENDREPEAT`);
  assert.throws(() => parseFitlog(block, "lb", {}), (error: unknown) => error instanceof Error && error.message === "Grappling is recorded after the session: use MODE|summary with DURATION and NOTES, not SEGMENT lines.");
});

test("v110: v2 legacy behavior is untouched — segmented grappling and mobility still parse, yoga still refused", () => {
  const grappling = parseFitlog(v2(`CARDIO|Rolling
TYPE|grappling
MODE|segments
SEGMENT|other|5 min|
SEGMENT|rest|1 min|`), "lb", {});
  assert.equal(grappling.cardio[0].segments?.length, 2);
  const mobility = parseFitlog(v2(`MOBILITY|Stretch
MODE|segments
SEGMENT|other|60 sec|`), "lb", {});
  assert.equal(mobility.cardio[0].segments?.length, 1);
  assert.throws(() => parseFitlog(v2(`CARDIO|Yoga flow
TYPE|yoga
MODE|segments
SEGMENT|other|5 min|`), "lb", {}), (error: unknown) => error instanceof Error && error.message === "Yoga is recorded after the session: use MODE|summary with DURATION and NOTES, not SEGMENT lines.");
});

test("v110: v1 and v2 golden blocks still parse unchanged", () => {
  const goldenV1 = parseFitlog(v1(`EXERCISE|Barbell Bench Press
SET|5|135 lb total||WARMUP
SET|6-8|185 lb total|RIR 2
REST|180
CARDIO|Easy run
TYPE|run
DURATION|30
INTENSITY|Easy conversational effort`), "lb", {});
  assert.equal(goldenV1.exercises[0].sets.length, 2);
  assert.equal(goldenV1.cardio[0].plannedDurationMin, 30);
  const goldenV2 = parseFitlog(v2(`CARDIO|Run/walk session
TYPE|run
MODE|segments
REPEAT|6
SEGMENT|run|4 min|
SEGMENT|walk|1 min|
ENDREPEAT
SEGMENT|run|10 min|`), "lb", {});
  assert.equal(goldenV2.cardio[0].segments?.length, 13);
});

test("v113: the v3 example is a safe strength workout plus an easy run and parses cleanly", () => {
  const workout = parseFitlog(exampleFitlogV3(), "lb", {});
  assert.equal(workout.exercises.length, 1);
  assert.equal(workout.cardio.length, 1);
  assert.equal(workout.cardio[0].segments?.length ?? 0, 0);
  assert.deepEqual(workout.importWarnings, []);
  const text = workoutToText(workout);
  assert.match(text, /Barbell Back Squat/);
  assert.match(text, /Easy run/);
});

test("v110: coach prompts carry exactly one OUTPUT FORMAT section and it is v3", () => {
  const state = defaultState();
  for (const mode of ["new", "continue"] as const) {
    const prompt = buildCoachPrompt(state, { mode, days: 7, energy: "", sleep: "", soreness: "", timeAvailable: "", equipment: "", restrictions: "", schedule: "", request: "" });
    assert.equal((prompt.match(/OUTPUT FORMAT/g) ?? []).length, 1, `${mode} prompt has exactly one OUTPUT FORMAT section`);
    assert.match(prompt, /\[FITLOG:3\]/);
    assert.doesNotMatch(prompt, /\[FITLOG:1\]/);
    assert.doesNotMatch(prompt, /\[FITLOG:2\]/);
  }
  assert.ok(buildCoachPrompt(state, { mode: "new", days: 7, energy: "", sleep: "", soreness: "", timeAvailable: "", equipment: "", restrictions: "", schedule: "", request: "" }).includes(FITLOG_V3_INSTRUCTIONS));
  assert.ok(buildCoachPrompt(state, { mode: "continue", days: 7, energy: "", sleep: "", soreness: "", timeAvailable: "", equipment: "", restrictions: "", schedule: "", request: "" }).includes(FITLOG_V3_REMINDER));
});

test("v110: v3 instructions state AMRAP and non-run segment kinds so the AI cannot invent them", () => {
  assert.match(FITLOG_V3_INSTRUCTIONS, /AMRAP has no fixed rounds/);
  assert.match(FITLOG_V3_INSTRUCTIONS, /never REPEAT with an invented round count/);
  assert.match(FITLOG_V3_INSTRUCTIONS, /For bike, row, hike, and other non-run activities, use kind other/);
  assert.match(FITLOG_V3_REMINDER, /AMRAP has no fixed rounds/);
});

test("v110: profile paragraph scopes INTERVALS to summary-mode runs and lives in the default profile", () => {
  assert.match(NEW_COACH_PROFILE_PARAGRAPH, /INTERVALS\|6 x \(3 min run \/ 1 min walk\) for SUMMARY-mode runs/);
  assert.match(NEW_COACH_PROFILE_PARAGRAPH, /MODE\|segments with REPEAT for segmented runs/);
  assert.match(NEW_COACH_PROFILE_PARAGRAPH, /post-session only: MODE\|summary with DURATION and NOTES, never SEGMENT lines/);
  assert.ok(DEFAULT_COACH_PROFILE.includes(NEW_COACH_PROFILE_PARAGRAPH));
});
