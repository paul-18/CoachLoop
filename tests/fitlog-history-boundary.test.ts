import assert from "node:assert/strict";
import test from "node:test";
import { parseFitlog } from "../app/interchange/fitlog";
import { defaultState } from "../app/domain/training-types";
import { prepareLoadedState } from "../app/persistence/migrations";
import { mergeRestoredState } from "../app/persistence/cloud-sync";

test("new FITLOG prescriptions and rejected format versions cannot rewrite saved workout evidence", () => {
  const original = "[FITLOG:1]\nWORKOUT|Bench day|2026-10-01\nEXERCISE|Bench press\nSET|6|185 lb|RIR 2\n[/FITLOG]";
  const saved = parseFitlog(original, "lb", {});
  saved.status = "completed";
  saved.completedAt = "2026-10-01T17:00:00Z";
  const set = saved.exercises[0].sets[0];
  set.completed = true;
  set.actualReps = "5";
  set.actualWeight = 195;
  const state = { ...defaultState(), workouts: [saved] };
  const serialized = JSON.stringify(state);
  const next = parseFitlog(original.replace("185 lb", "225 lb").replace("2026-10-01", "2026-10-02"), "lb", {});
  assert.equal(next.exercises[0].sets[0].plannedWeight, 225);
  assert.equal(JSON.stringify(state), serialized);
  assert.throws(() => parseFitlog(original.replace("FITLOG:1", "FITLOG:2"), "lb", {}), /version 1/);
  const loaded = prepareLoadedState(JSON.parse(serialized));
  const restored = mergeRestoredState(defaultState(), loaded);
  for (const snapshot of [loaded, restored]) {
    const workout = snapshot.workouts[0];
    assert.equal(workout.id, saved.id);
    assert.equal(workout.date, "2026-10-01");
    assert.equal(workout.exercises[0].sets[0].actualWeight, 195);
    assert.equal(workout.exercises[0].sets[0].actualReps, "5");
    assert.equal(workout.exercises[0].sets[0].plannedWeight, 185);
  }
});
