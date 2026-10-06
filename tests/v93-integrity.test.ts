import assert from "node:assert/strict";
import test from "node:test";
import { defaultState } from "../app/domain/training-types";
import { parseBackup, parseBackupReview, restoredState } from "../app/persistence/backup-tools";
import { verifyBackup } from "../app/persistence/backup-verification";
import { parseFitlog, FITLOG_INSTRUCTIONS, FITLOG_REMINDER } from "../app/interchange/fitlog";

test("current-format backup verification and restore reject missing timestamps and unknown units without losing records", () => {
  const state = defaultState();
  state.waistEntries = [{ id: "waist", date: "2026-10-04", cm: 80, updatedAt: "2026-10-04T12:00:00Z" }];
  state.bodyweightEntries = [{ id: "weight", date: "2026-10-04", weight: 180, unit: "lb", updatedAt: "2026-10-04T12:00:00Z" }];
  const original = JSON.stringify(state);
  for (const section of ["waistEntries", "bodyweightEntries"] as const) {
    const broken = JSON.parse(original); delete broken[section][0].updatedAt;
    assert.throws(() => parseBackup(JSON.stringify(broken)), /Invalid .*record/);
    assert.throws(() => verifyBackup(JSON.stringify(broken)), /Invalid .*record/);
  }
  const broken = JSON.parse(original); broken.bodyweightEntries[0].unit = "stone";
  assert.throws(() => parseBackup(JSON.stringify(broken)), /lb\/kg/);
  broken.bodyweightEntries[0].unit = "lb"; broken.waistEntries[0].updatedAt = "tomorrow";
  assert.throws(() => parseBackup(JSON.stringify(broken)), /invalid data/);
  const badIncrement = JSON.parse(original); badIncrement.loadIncrements = { Bench: { value: 5 } };
  assert.throws(() => parseBackup(JSON.stringify(badIncrement)), /invalid data/);
  assert.equal(JSON.stringify(state), original);
  assert.equal(verifyBackup(original).waistEntries, 1);
});

test("legacy measurements retain records with deterministic date timestamps, disclose repair, and cannot become today's newest edit", () => {
  const current = defaultState();
  current.bodyweightEntries = [{ id: "weight", date: "2026-10-04", weight: 180, unit: "lb", updatedAt: "2026-10-04T12:00:00Z" }];
  const legacy = JSON.parse(JSON.stringify(current)); delete legacy.evidenceVersion;
  delete legacy.bodyweightEntries[0].updatedAt; legacy.bodyweightEntries[0].weight = 150;
  legacy.waistEntries = [{ id: "waist", date: "2026-10-04", cm: 80 }];
  const text = JSON.stringify(legacy), first = parseBackupReview(text), second = parseBackupReview(text);
  assert.equal(first.state.bodyweightEntries[0].updatedAt, "2026-10-04T00:00:00.000Z");
  assert.equal(first.state.waistEntries![0].updatedAt, "2026-10-04T00:00:00.000Z");
  assert.deepEqual(second.state.bodyweightEntries, first.state.bodyweightEntries);
  assert.equal(restoredState(current, first.state).bodyweightEntries[0].weight, 180);
  assert.equal(restoredState(current, first.state, "replace").bodyweightEntries[0].weight, 150);
  assert.match(first.notices.join(" "), /2 legacy measurement timestamp/);
  assert.deepEqual(verifyBackup(text).notices, first.notices);
});

test("FITLOG rejects conflicting exercise and effort rest targets; equivalent repeats stay compatible", () => {
  const wrap = (body: string) => `[FITLOG:1]\nWORKOUT|Synthetic rest test|2026-10-05\n${body}\n[/FITLOG]`;
  for (const body of ["EXERCISE|Bench\nSET|5|100 lb total\nREST|60\nSET|5|100 lb total\nREST|180", "CARDIO|Carry\nTYPE|force\nEFFORT|20 m|90 lb|\nREST|60\nEFFORT|20 m|90 lb|\nREST|180"]) {
    assert.throws(() => parseFitlog(wrap(body), "lb", {}), /Line.*REST: conflicting.*one rest target/);
  }
  assert.throws(() => parseFitlog(wrap("EXERCISE|Bench\nSET|5|100 lb total\nREST|"), "lb", {}), /REST: enter a finite rest target/);
  const exercise = parseFitlog(wrap("EXERCISE|Bench\nSET|5|100 lb total\nREST|60\nSET|5|100 lb total\nREST|1 min\nEXERCISE|Row\nSET|8|80 lb total\nREST|90"), "lb", {});
  assert.deepEqual(exercise.exercises.map(e => e.restSec), [60, 90]);
  assert.match(FITLOG_INSTRUCTIONS, /one REST line per exercise/i);
  assert.match(FITLOG_REMINDER, /one REST\|seconds per exercise/);
});
