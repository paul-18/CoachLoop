import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_RELEASE } from "../app/app-release";
import { exampleSafeImportFitlog, parseFitlog } from "../app/interchange/fitlog";

const root = fileURLToPath(new URL("../", import.meta.url));

test("v122: APP_RELEASE is v122", () => {
  assert.equal(APP_RELEASE, "v122");
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
  assert.match(css, /input\[type="date"\]\s*\{[^}]*-webkit-appearance:\s*none;/);
  assert.match(css, /input\[type="date"\]\s*\{[^}]*appearance:\s*none;/);
  assert.match(css, /input\[type="date"\]\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0;/);
  assert.match(css, /input\[type="date"\]::-webkit-date-and-time-value\s*\{[^}]*min-height:\s*1lh;/);
  assert.match(css, /input\[type="date"\]::-webkit-datetime-edit[^}]*padding:\s*0;/);
});

test("v119 maintenance: completing a set does not auto-focus the next reps field", () => {
  const editor = fs.readFileSync(path.join(root, "app/views/workout-editor.tsx"), "utf8");
  assert.ok(editor.includes('document.getElementById(`reps-${set.id}`)?.focus()'), "validation still focuses the current reps field when confirmation is required");
  assert.ok(!editor.includes("nextIncomplete"), "completion must not move focus to the next set and open the mobile keyboard");
  assert.ok(!editor.includes("queueMicrotask(() => document.getElementById"), "completion must not schedule an automatic input focus");
});

test("v119 maintenance: native date inputs and their labels are shrinkable and fill their containers", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.field-label\s*\{[^}]*min-width:\s*0;/);
  assert.match(css, /input\[type="date"\]\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0;/);

  const dateDialog = fs.readFileSync(path.join(root, "app/views/workout-date-dialog.tsx"), "utf8");
  assert.ok(dateDialog.includes('className="field-label block min-w-0"'));
  assert.ok(dateDialog.includes("block w-full min-w-0 max-w-full box-border"));
});

test("v117: stepper done current button has subdued font weight", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.stepper-done-current\s*\{[^}]*font-weight:\s*650;/);
});


test("v119 maintenance: PT schedule archives past events and ended training periods", () => {
  const settings = fs.readFileSync(path.join(root, "app/views/settings-view.tsx"), "utf8");
  assert.ok(settings.includes('entry.date >= scheduleToday'));
  assert.ok(settings.includes('entry.date < scheduleToday'));
  assert.ok(settings.includes('phase.end >= scheduleToday'));
  assert.ok(settings.includes('phase.end < scheduleToday'));
  assert.ok(settings.includes('Archived events · {archivedEvents.length}'));
  assert.ok(settings.includes('Archived training periods · {archivedPhases.length}'));
});

test("v119 maintenance: PT schedule date fields use shrinkable mobile grid tracks", () => {
  const settings = fs.readFileSync(path.join(root, "app/views/settings-view.tsx"), "utf8");
  assert.ok(settings.includes('className="schedule-form-grid mt-2 grid'));
  assert.ok(settings.includes('className="schedule-form-grid periods mt-2 grid'));
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.ok(css.includes(".schedule-form-grid { width:100%; min-width:0; max-width:100%; grid-template-columns:minmax(0,1fr); }"));
  assert.ok(css.includes(".schedule-form-grid input[type=\"date\"] { min-inline-size:0;"));
});


test("v120: native date inputs opt out of iOS intrinsic sizing without removing the native picker type", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /input\[type="date"\]\s*\{[^}]*-webkit-appearance:\s*none;[^}]*appearance:\s*none;/);
  assert.match(css, /input\[type="date"\]::-webkit-date-and-time-value\s*\{[^}]*text-align:\s*left;[^}]*min-height:\s*1\.2em;[^}]*min-height:\s*1lh;/);
  assert.match(css, /input\[type="date"\]::-webkit-calendar-picker-indicator/);
});
