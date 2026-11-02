import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_RELEASE } from "../app/app-release";
import { exampleSafeImportFitlog, parseFitlog } from "../app/interchange/fitlog";

const root = fileURLToPath(new URL("../", import.meta.url));

test("v118: APP_RELEASE is v118", () => {
  assert.equal(APP_RELEASE, "v118");
});

test("v117: safe import example showcases leg press and interval run without segments", () => {
  const sample = exampleSafeImportFitlog("lb");
  assert.ok(sample.includes("EXERCISE|Leg Press"));
  assert.ok(sample.includes("SET|8|360 lb total|RPE 8"));
  assert.ok(sample.includes("CARDIO|Interval run"));
  assert.ok(sample.includes("INTERVALS|4 x (3 min run / 1 min walk)"));
  assert.ok(!sample.includes("SEGMENT|"));
  assert.ok(!sample.includes("REPEAT|"));

  const parsed = parseFitlog(sample, "lb", {});
  assert.equal(parsed.importWarnings?.length ?? 0, 0);
  assert.ok(parsed.exercises.some((e) => e.name === "Leg Press"));
  assert.ok(parsed.cardio.some((c) => c.name === "Interval run" && c.intervals));
});

test("v117: import dialog has only one safe example button without load segments", () => {
  const todayView = fs.readFileSync(path.join(root, "app/views/today-view.tsx"), "utf8");
  assert.ok(todayView.includes("Load a safe example"));
  assert.ok(!todayView.includes("Load a segments example"));
});

test("v117: export history inputs are block-aligned with left-aligned date values", () => {
  const historyView = fs.readFileSync(path.join(root, "app/views/history-view.tsx"), "utf8");
  assert.ok(historyView.includes('grid grid-cols-1 gap-3 sm:grid-cols-3'));
  assert.ok(historyView.includes('field-label block min-w-0'));

  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.field-label\s*\{\s*display:\s*block;/);
  assert.match(css, /input\[type="date"\]\s*\{\s*text-align:\s*left;/);
});

test("v117: stepper done current button has subdued font weight", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.stepper-done-current\s*\{[^}]*font-weight:\s*650;/);
});
