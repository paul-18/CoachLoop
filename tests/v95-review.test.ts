import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatMeasure, performedDistance, performedDuration } from "../app/domain/completion";
import { defaultState, makeCardio, makeWorkout } from "../app/domain/training-types";
import { exportCompletedHistory } from "../app/interchange/history-export";
import { parseFitlog } from "../app/interchange/fitlog";
import { EditorLeaseNotice } from "../app/shell/editor-gate";

const effort = (id: string) => ({
  id,
  plannedDistanceM: 100,
  actualDistanceM: 100,
  plannedDurationSec: 10,
  actualDurationSec: 10,
  plannedLoad: null,
  actualLoad: null,
  completed: true,
});

test("effort totals print without binary float tails", () => {
  assert.equal(formatMeasure(0.1 + 0.1 + 0.1), "0.3");
  assert.equal(formatMeasure(70 / 60), "1.17");
  const state = defaultState();
  const workout = makeWorkout("lb", 60, "Sled sprints");
  workout.status = "completed";
  const activity = makeCardio("force", "Sled sprints");
  activity.completed = true;
  activity.efforts = [effort("a"), effort("b"), effort("c")];
  workout.cardio = [activity];
  workout.exercises = [];
  workout.blockOrder = [{ type: "activity", id: activity.id }];
  state.workouts = [workout];
  assert.notEqual(performedDistance(activity), 0.3);
  assert.match(exportCompletedHistory(state), /0\.3 km/);
  assert.match(exportCompletedHistory(state), /0\.5 min/);
  assert.doesNotMatch(exportCompletedHistory(state), /0000/);
  activity.efforts = Array.from({ length: 7 }, (_, index) => effort(`e${index}`));
  assert.match(String(performedDuration(activity)), /1666/);
  const seven = exportCompletedHistory(state);
  assert.match(seven, /0\.7 km/);
  assert.match(seven, /1\.17 min/);
  assert.doesNotMatch(seven, /1666/);
});

test("mobility interval text parses without a backtracking freeze", () => {
  const workout = parseFitlog(`[FITLOG:1]\nWORKOUT|Mobility|2026-10-11\nMOBILITY|Hip mobility\nINTERVALS|Adductor rock-back - 2 × 8/side; Hip flexor stretch: 2 × 30 sec/side\n[/FITLOG]`, "lb", {});
  assert.deepEqual(workout.cardio[0]?.mobilityMoves.map(move => [move.name, move.prescription]), [
    ["Adductor rock-back", "2 × 8/side"],
    ["Hip flexor stretch", "2 × 30 sec/side"],
  ]);
  const started = performance.now();
  parseFitlog(`[FITLOG:1]\nWORKOUT|Mobility|2026-10-11\nMOBILITY|Stretch\nINTERVALS|${" ".repeat(10_000)}\n[/FITLOG]`, "lb", {});
  assert.ok(performance.now() - started < 50, "10k spaces must parse in under 50 ms");
});

test("an interrupted editor can be retried and is not described as an unsupported browser", () => {
  const interrupted = renderToStaticMarkup(createElement(EditorLeaseNotice, { lease: "interrupted", onRetry: () => {} }));
  assert.match(interrupted, /Try again/);
  assert.match(interrupted, /still on this phone/);
  assert.doesNotMatch(interrupted, /cannot safely coordinate/);
  const unsupported = renderToStaticMarkup(createElement(EditorLeaseNotice, { lease: "unsupported", onRetry: () => {} }));
  assert.match(unsupported, /Try again/);
  assert.match(unsupported, /cannot safely coordinate/);
});
