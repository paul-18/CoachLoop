import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_RELEASE } from "../app/app-release";

const root = fileURLToPath(new URL("../", import.meta.url));

test("v122: APP_RELEASE is v122", () => {
  assert.equal(APP_RELEASE, "v122");
});

test("v116: dialog styling enforces screen margin gutters", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\[role="dialog"\]\s*\{\s*max-width:\s*calc\(100vw - 28px\);/);
  assert.doesNotMatch(css, /\[role="dialog"\]\s*\{\s*max-width:\s*100vw;/);
});

test("v116: exercise-setup options row is contained within the card header", () => {
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.exercise-title-line\s*\{[^}]*position:\s*static;/);
  assert.match(css, /\.exercise-card\s*\[data-slot="card-header"\]\s*\{[^}]*position:\s*relative;/);
  assert.match(css, /\.exercise-setup\[open\]\s*>\s*\.exercise-options-row[^}]*left:\s*12px;\s*right:\s*12px;/);
});

test("v116: coach brief dialog has header right padding and clear button in body", () => {
  const todayView = fs.readFileSync(path.join(root, "app/views/today-view.tsx"), "utf8");
  // DialogHeader pr-12 prevents X button overlap
  assert.ok(todayView.includes('DialogHeader className="border-b border-white/8 p-4 pr-12 pb-3 text-left"'));
  // Clear today's fields is placed above today's readiness, not inside DialogHeader
  assert.ok(todayView.includes("Today’s readiness & context"));
  assert.ok(todayView.includes("Clear today’s fields"));
});

test("v116: dropdown menus have safe collision padding and align end", () => {
  const workoutEditor = fs.readFileSync(path.join(root, "app/views/workout-editor.tsx"), "utf8");
  // Exercise card menu
  assert.ok(workoutEditor.includes('DropdownMenuContent align="end" sideOffset={6} collisionPadding={16}'));
});
