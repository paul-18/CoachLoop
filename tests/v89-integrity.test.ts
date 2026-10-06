import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, makeWorkout, makeSet, makeCardio } from "../app/domain/training-types";
import { parseBackup, serializeBackup, restoredState } from "../app/persistence/backup-tools";
import { reviewRestore, restoreDetails, sharedProvenance } from "../app/persistence/backup-review";
import { validateSyncedState } from "../app/persistence/training-validation";
import { editedSet, completedSetValues, hasTrainingEvidence, hasWorkingStrength, hasTrainingActivity } from "../app/domain/completion";
import { weeklyTrainingSignals } from "../app/domain/training-snapshot";
import { trainingWeekStreak } from "../app/domain/training-streak";
import { workoutLiftingVolume } from "../app/domain/training-metrics";
import { parseFitlog } from "../app/interchange/fitlog";
import { workoutToText } from "../app/interchange/coach-export";

test("restore preserves distinct workouts sharing provenance, including sets and notes", () => {
  const left = defaultState(), right = defaultState(), a = makeWorkout("lb", 120, "First");
  const b = structuredClone(a); b.id = "second"; b.name = "Second";
  a.originKey = b.originKey = "legacy-import";
  a.notes = "First original note"; b.notes = "Second original note";
  a.exercises[0].sets[0].actualReps = "6"; b.exercises[0].sets[0].actualReps = "8";
  left.workouts = [a]; right.workouts = [b];
  const result = restoredState(left, right);
  assert.equal(result.workouts.length, 2);
  assert.deepEqual(new Set(result.workouts.map(w => w.notes)), new Set([a.notes, b.notes]));
  assert.deepEqual(new Set(result.workouts.map(w => w.exercises[0].sets[0].actualReps)), new Set(["6", "8"]));
  assert.equal(sharedProvenance(result)[0].length, 2);
});

test("contradictory live/deleted workouts, exercises, activities and sets reject before restore", () => {
  for (const level of ["workout", "exercise", "activity", "set"]) {
    const s = defaultState(), w = makeWorkout("lb", 120);
    s.workouts = [w]; const e = w.exercises[0];
    if (level === "workout") s.deletedWorkoutIds = [w.id];
    if (level === "exercise") w.deletedExerciseIds = [e.id];
    if (level === "set") e.deletedSetIds = [e.sets[0].id];
    if (level === "activity") { const c = makeCardio("run"); w.cardio = [c]; w.blockOrder.push({ type: "activity", id: c.id }); w.deletedActivityIds = [c.id]; }
    const raw = JSON.stringify(s);
    assert.throws(() => parseBackup(raw), /also marked deleted/);
    assert.throws(() => serializeBackup(s), /also marked deleted/);
    assert.throws(() => restoredState(defaultState(), s, "replace"), /also marked deleted/);
    assert.equal(JSON.stringify(s), raw, "original contradictory evidence remains intact");
  }
});

test("deletion plus newer header produces valid merged order; failed preview permits replacement", () => {
  const base = defaultState(), backup = defaultState(), a = makeWorkout("lb", 120);
  const newer = structuredClone(a); newer.updatedAt = "2026-10-03T12:00:00.000Z";
  a.updatedAt = "2026-10-02T12:00:00.000Z";
  a.deletedExerciseIds = [a.exercises[0].id]; a.exercises = []; a.blockOrder = [];
  base.workouts = [a]; backup.workouts = [newer];
  validateSyncedState(base); validateSyncedState(backup);
  const merged = reviewRestore(base, backup, "merge", false);
  assert.equal(merged.error, ""); assert.deepEqual(merged.review!.next.workouts[0].blockOrder, []);
  // Simulate an inconsistent current in-memory record. Backup remains valid.
  const broken = structuredClone(base); broken.settings.barWeightLb = -1;
  assert.ok(reviewRestore(broken, backup, "merge", false).error);
  assert.equal(reviewRestore(broken, backup, "replace", false).error, "");
});

test("restore review exposes exact set corrections, notes, removed blocks and section values", () => {
  const base = defaultState(); base.workouts = [makeWorkout("lb", 120, "Review this")];
  const next = structuredClone(base);
  next.workouts[0].exercises[0].sets[0].actualReps = "8";
  next.workouts[0].notes = "Correction note";
  const lines = restoreDetails(base, next)[0].lines.join("\n");
  assert.match(lines, /actualReps: "" → "8"/); assert.match(lines, /Correction note/);
});

test("invalid completed edits become incomplete drafts; valid corrections retain credit", () => {
  const original = makeSet("lb", { completed: true, actualReps: "6", actualWeight: 100, loadType: "weighted" });
  const stamp = new Date().toISOString();
  for (const changes of [{ actualReps: "" }, { actualReps: "abc" }, { actualReps: "6-8" }, { actualReps: "6.5" }, { actualReps: "0" }, { rpe: "999" }, { rir: "-3" }, { rpe: "8", rir: "2" }]) {
    const draft = editedSet(original, changes, stamp);
    assert.equal(draft.completed, false); assert.equal(draft.completedAsPlanned, false);
    if (changes.actualReps !== "") assert.throws(() => completedSetValues(draft));
    const w = makeWorkout("lb", 120); w.exercises[0].sets = [draft];
    assert.equal(workoutLiftingVolume(w, "lb").volume, 0);
  }
  const corrected = editedSet(original, { actualReps: "8", rpe: "8.5" }, stamp);
  assert.equal(corrected.completed, true); assert.equal(original.actualReps, "6");
  const incomplete = editedSet(original, { actualReps: "" }, stamp);
  const validDraft = editedSet(incomplete, { actualReps: "7", rir: "0" }, stamp);
  assert.equal(validDraft.completed, false, "completion requires an explicit tap after fixing a draft");
  assert.equal(completedSetValues(validDraft).actualReps, "7");
});

test("empty and warm-up-only sessions do not count; child efforts and HYROX splits do", () => {
  const s = defaultState(), empty = makeWorkout("lb", 120), warm = makeWorkout("lb", 120), partial = makeWorkout("lb", 120);
  for (const w of [empty, warm, partial]) { w.status = "completed"; w.date = "2026-10-02"; }
  warm.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "8", warmup: true })];
  partial.cardio = [{ ...makeCardio("circuit"), completed: false, efforts: [{ id: "effort", completed: true, plannedDistanceM: null, actualDistanceM: 20, plannedDurationSec: null, actualDurationSec: 30, plannedLoad: null, actualLoad: null }] }];
  assert.equal(hasTrainingEvidence(empty), false); assert.equal(hasWorkingStrength(warm), false);
  assert.equal(hasTrainingActivity(partial), true);
  s.workouts = [empty, warm, partial];
  assert.equal(weeklyTrainingSignals(s, "2026-10-04").loggedSessions, 1);
  assert.equal(trainingWeekStreak(s, "2026-10-04").daysThisWeek, 1);
  assert.match(workoutToText(empty), /no completed working training evidence/);
  partial.date = "2026-10-05";
  assert.equal(trainingWeekStreak(s, "2026-10-04").daysThisWeek, 0);
});

test("FITLOG first loaded effort establishes unit, then genuinely mixed units reject", () => {
  const wrap = (body: string) => `[FITLOG:1]\nWORKOUT|Carry|2026-10-04\nCARDIO|Carry\nTYPE|force\n${body}\n[/FITLOG]`;
  const result = parseFitlog(wrap("EFFORT|20 m||10 sec\nEFFORT|20 m|10 kg|10 sec"), "lb", {});
  assert.equal(result.cardio[0].effortLoadUnit, "kg");
  assert.equal(result.cardio[0].efforts![0].plannedLoad, null);
  assert.throws(() => parseFitlog(wrap("EFFORT|20 m|10 kg|10 sec\nEFFORT|20 m|10 lb|10 sec"), "lb", {}), /same load unit/);
});

test("FITLOG header ordering, scalar duplicates and extra columns reject with line errors", () => {
  const wrap = (body: string) => `[FITLOG:1]\n${body}\n[/FITLOG]`;
  assert.throws(() => parseFitlog(wrap("EXERCISE|Bench\nSET|6|100 lb total\nWORKOUT|Test|2026-10-04"), "lb", {}), /Line.*WORKOUT must be the first/);
  assert.throws(() => parseFitlog(wrap("WORKOUT|Test|2026-10-04\nCARDIO|Run\nDURATION|20\nDURATION|30"), "lb", {}), /Line.*DURATION.*already supplied/);
  assert.throws(() => parseFitlog(wrap("WORKOUT|Test|2026-10-04|extra\nCARDIO|Run"), "lb", {}), /Line.*WORKOUT.*expected 2/);
  assert.throws(() => parseFitlog(wrap("WORKOUT|Test|2026-10-04\nMOBILITY|Routine\nMOVE|Stretch|30 seconds|extra"), "lb", {}), /MOVE.*expected 2/);
  // Equivalent REST repeats remain compatible; differing targets must not silently overwrite. NOTES accumulate.
  assert.equal(parseFitlog(wrap("WORKOUT|Test|2026-10-04\nEXERCISE|Bench\nSET|6|100 lb total\nREST|90\nSET|6|100 lb total\nREST|90\nNOTES|Cue one\nNOTES|Cue two"), "lb", {}).exercises[0].restSec, 90);
});
