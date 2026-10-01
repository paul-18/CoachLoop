import test from "node:test";
import assert from "node:assert/strict";
import { HYROX_DIVISIONS, hyroxPreset, makeHyroxWorkout, hyroxTotal, hyroxCurrentIndex, updateHyrox, correctHyroxSplit, hyroxExport } from "../app/hyrox";
import { defaultState } from "../app/training-types";
import { mergeTrainingStates } from "../app/cloud-sync";
import { exportCompletedHistory } from "../app/history-export";
import { workoutToText } from "../app/coach-export";

test("all four singles divisions have the official order, distances, loads and target heights", () => {
  for (const division of Object.keys(HYROX_DIVISIONS) as Array<keyof typeof HYROX_DIVISIONS>) {
    const plan = hyroxPreset(division);
    assert.equal(plan.length, 16);
    assert.equal(plan.filter((s) => s.kind === "run").reduce((sum,s) => sum+s.distanceM!, 0), 8000);
    assert.ok(plan.every((s,i) => s.kind === (i%2 === 0 ? "run" : "station")));
    assert.deepEqual(plan.filter((s) => s.kind === "station").map((s) => s.name), ["SkiErg","Sled Push","Sled Pull","Burpee Broad Jumps","Row","Farmers Carry","Sandbag Lunges","Wall Balls"]);
    const tier = division === "women_open" ? 0 : division === "men_pro" ? 2 : 1;
    assert.equal(plan[3].loadKg, [102,152,202][tier]);
    assert.equal(plan[5].loadKg, [78,103,153][tier]);
    assert.equal(plan[11].loadKg, [16,24,32][tier]);
    assert.equal(plan[11].loadCount, 2);
    assert.equal(plan[13].loadKg, [10,20,30][tier]);
    assert.equal(plan[15].loadKg, [4,6,9][tier]);
    assert.equal(plan[15].reps, 100);
    assert.equal(plan[15].targetM, division.startsWith("women") ? 2.7 : 3);
  }
});

test("timestamp timer survives JSON reload, excludes explicit pauses and records independent splits", () => {
  let w = makeHyroxWorkout("men_open");
  w = updateHyrox(w, "start", 1000);
  w = JSON.parse(JSON.stringify(w));
  assert.equal(hyroxTotal(w.hyrox!, 61000), 60000);
  w = updateHyrox(w, "pause", 61000);
  assert.equal(hyroxTotal(w.hyrox!, 90000), 60000);
  w = updateHyrox(w, "start", 91000);
  w = updateHyrox(w, "complete", 121000);
  assert.equal(w.hyrox!.segments[0].splitMs, 90000);
  assert.equal(w.cardio[0].actualDurationMin, 1.5);
  assert.equal(w.cardio[0].actualDistanceKm, 1);
  assert.equal(w.cardio[1].completed, false);
  w = updateHyrox(w, "complete", 151000);
  assert.equal(w.hyrox!.segments[1].splitMs, 30000);
  assert.equal(hyroxTotal(w.hyrox!, 161000), 130000);
  w = updateHyrox(w, "undo", 161000);
  assert.equal(hyroxCurrentIndex(w.hyrox!), 1);
  assert.equal(w.cardio[1].completed, false);
  assert.equal(w.cardio[1].actualDistanceKm, null);
  assert.equal(hyroxTotal(w.hyrox!, 161000), 130000);
});

test("complete simulation stops the clock, exports splits, and a repeat clears all timing", () => {
  let w = updateHyrox(makeHyroxWorkout("women_pro"), "start", 1000);
  for (let i=0;i<16;i++) w = updateHyrox(w, "complete", 1000+(i+1)*60000);
  assert.equal(hyroxCurrentIndex(w.hyrox!), -1);
  assert.equal(w.hyrox!.runningSince, null);
  assert.equal(hyroxTotal(w.hyrox!, 99999999), 960000);
  w.status = "completed";
  w.completedAt = new Date(961000).toISOString();
  w = correctHyroxSplit(w, w.hyrox!.segments[0].id, 90000);
  assert.equal(hyroxTotal(w.hyrox!), 990000);
  assert.equal(w.cardio[0].actualDurationMin, 1.5);
  const state = defaultState(); state.workouts = [w];
  assert.match(exportCompletedHistory(state), /Run 1: 1,?000 m · 1:30 \(corrected\)/);
  assert.match(workoutToText(w), /Wall Balls: 100 reps · 6 kg · 2.7 m target · 1:00/);
  const repeated = makeHyroxWorkout(w.hyrox!.division, w.hyrox!.segments);
  assert.equal(repeated.hyrox!.started, false);
  assert.ok(repeated.hyrox!.segments.every((s) => s.splitMs === null));
  assert.ok(repeated.cardio.every((a) => !a.completed && a.actualDurationMin === null));
  assert.notEqual(repeated.cardio[0].id, w.cardio[0].id);
});

test("partial sessions never credit unfinished distance and custom setups remain marked", () => {
  const plan = hyroxPreset("men_pro"); plan[3].loadKg = 180;
  let w = updateHyrox(makeHyroxWorkout("men_pro", plan), "start", 1000);
  w = updateHyrox(w, "complete", 61000);
  w = updateHyrox(w, "end", 91000);
  assert.equal(w.hyrox!.modified, true);
  assert.equal(w.hyrox!.endedEarly, true);
  assert.equal(w.hyrox!.segmentElapsedMs, 30000);
  assert.equal(w.hyrox!.runningSince, null);
  assert.equal(w.cardio.filter((a) => a.completed).length, 1);
  assert.equal(w.cardio[1].actualDistanceKm, null);
  w.status = "completed";
  assert.match(hyroxExport(w).join("\n"), /Partial/);
  const state = defaultState(); state.workouts = [w];
  assert.deepEqual(mergeTrainingStates(state, defaultState()).workouts[0].hyrox, w.hyrox);
});
