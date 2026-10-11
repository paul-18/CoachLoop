import test from "node:test";
import assert from "node:assert/strict";
import { parseFitlog } from "../app/interchange/fitlog";

const documentFor = (intervals: string) =>
  `[FITLOG:1]\nWORKOUT|Move|2026-01-15\nMOBILITY|Stretch\nINTERVALS|${intervals}\n[/FITLOG]`;

const almost = (unit: string, bytes: number) => {
  const extra = " leftover";
  const raw = unit.repeat(Math.ceil(bytes / unit.length));
  return raw.slice(0, Math.max(0, bytes - extra.length)) + extra;
};

const elapsed = (text: string, runs: number) => {
  const start = performance.now();
  for (let i = 0; i < runs; i++) parseFitlog(text, "lb", {});
  return performance.now() - start;
};

test("trailing_separator_strip_grows_linearly", () => {
  const dash16 = documentFor(almost(" -", 16 * 1024));
  const dash32 = documentFor(almost(" -", 32 * 1024));
  const colon16 = documentFor(almost(" :", 16 * 1024));
  const colon32 = documentFor(almost(" :", 32 * 1024));
  elapsed(dash16, 1);
  elapsed(dash32, 1);
  let runs = 1;
  while (elapsed(dash16, runs) < 25 && runs < 128) runs *= 2;
  const dashSmall = elapsed(dash16, runs);
  const dashLarge = elapsed(dash32, runs);
  const colonSmall = elapsed(colon16, runs);
  const colonLarge = elapsed(colon32, runs);
  assert.ok(dashLarge <= dashSmall * 3.5, `32KB dash tail took ${dashLarge.toFixed(1)} ms vs ${dashSmall.toFixed(1)} ms for 16KB`);
  assert.ok(colonLarge <= colonSmall * 3.5, `32KB colon tail took ${colonLarge.toFixed(1)} ms vs ${colonSmall.toFixed(1)} ms for 16KB`);
  assert.equal(parseFitlog(documentFor("-".repeat(32000)), "lb", {}).cardio[0]?.mobilityMoves[0]?.name, "Movement");
  const named = parseFitlog(documentFor("Hip flexor stretch — 30 sec/side"), "lb", {});
  assert.equal(named.cardio[0]?.mobilityMoves[0]?.name, "Hip flexor stretch");
  assert.match(named.cardio[0]?.mobilityMoves[0]?.prescription ?? "", /30 sec/);
});
