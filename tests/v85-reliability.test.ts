import assert from "node:assert/strict";
import test from "node:test";
import { defaultState, makeWorkout, makeSet } from "../app/domain/training-types";
import { startWorkoutState, resumeWorkoutState, finishWorkoutState, discardWorkoutState, selectedActiveWorkout } from "../app/domain/workout-transitions";
import { mergeRestoredState } from "../app/persistence/cloud-sync";
import { prepareLoadedState } from "../app/persistence/migrations";
import { parseBackup, serializeBackup, MAX_BACKUP_BYTES } from "../app/persistence/backup-tools";
import { readRecoveryData } from "../app/persistence/recovery-export";
import { coverageForLastDays, coverageSources } from "../app/domain/training-coverage";
import { validateSyncedState } from "../app/persistence/training-validation";

test("merged unfinished workouts remain reachable after finishing, discarding and reload", () => {
  const a = defaultState(), b = defaultState();
  const first = makeWorkout("lb", 120, "First"), second = makeWorkout("lb", 120, "Second");
  a.workouts = [first]; a.activeWorkoutId = first.id;
  b.workouts = [second]; b.activeWorkoutId = second.id;
  let state = mergeRestoredState(a, b);
  state = resumeWorkoutState(state, first.id);
  state = finishWorkoutState(state, first, "2026-10-03T12:00:00.000Z");
  assert.equal(selectedActiveWorkout(state)?.id, second.id);
  state = prepareLoadedState(JSON.parse(serializeBackup(state)));
  assert.equal(state.activeWorkoutId, second.id);
  assert.throws(() => startWorkoutState(state, makeWorkout("lb", 120)), /Finish or discard/);
  state = discardWorkoutState(state, second.id);
  assert.equal(state.activeWorkoutId, null);
  const third = makeWorkout("lb", 120);
  state = startWorkoutState(state, third);
  assert.equal(state.activeWorkoutId, third.id);
  validateSyncedState(state);
});

test("discard selects another unfinished workout; completing a history edit preserves the active one", () => {
  const state = defaultState(), a = makeWorkout("lb", 120), b = makeWorkout("lb", 120);
  state.workouts = [a, b]; state.activeWorkoutId = a.id;
  const next = discardWorkoutState(state, a.id);
  assert.equal(next.activeWorkoutId, b.id);
  assert.ok(next.deletedWorkoutIds.includes(a.id));
  const history = { ...a, status: "completed" as const, completedAt: "2026-10-01T12:00:00.000Z" };
  next.workouts.push(history);
  const edited = finishWorkoutState(next, { ...history, notes: "Correction" });
  assert.equal(edited.activeWorkoutId, b.id);
  assert.equal(edited.workouts.find(w => w.id === a.id)?.completedAt, history.completedAt);
  assert.equal(edited.workouts.find(w => w.id === a.id)?.date, history.date);
});

test("legacy orphaned active sessions recover a pointer without dropping workouts", () => {
  const state = defaultState(), workout = makeWorkout("lb", 120);
  state.workouts = [workout]; state.activeWorkoutId = null;
  assert.equal(selectedActiveWorkout(state)?.id, workout.id);
  assert.equal(prepareLoadedState(state).activeWorkoutId, workout.id);
  assert.throws(() => resumeWorkoutState(state, "missing"), /unfinished workout/);
});

test("starting a saved plan sets today's date while manual historical logging retains its date", () => {
  const state = defaultState(), plan = makeWorkout("lb", 120);
  plan.status = "planned"; plan.date = "2026-10-01"; plan.startedAt = null;
  state.workouts = [plan];
  const next = startWorkoutState(state, plan, "2026-10-03T12:00:00.000Z", "2026-10-03", "America/Moncton");
  assert.equal(next.workouts.length, 1);
  assert.equal(next.workouts[0].date, "2026-10-03");
  assert.equal(next.workouts[0].timezone, "America/Moncton");
  const manual = makeWorkout("lb", 120); manual.date = "2026-09-30";
  assert.equal(startWorkoutState(defaultState(), manual).workouts[0].date, manual.date);
});

test("recovery export preserves damaged raw data AND good checkpoints, even when one read fails", async () => {
  const raw = { damaged: "do not discard" };
  const copies = [{ id: "checkpoint", createdAt: "2026-10-03T12:00:00.000Z", reason: "before-restore", state: defaultState() }];
  const both = await readRecoveryData(async () => raw, async () => copies);
  assert.deepEqual(both.rawState, raw);
  assert.equal(both.recoveryCopies.length, 1);
  const partial = await readRecoveryData(async () => { throw new Error("Unavailable"); }, async () => copies);
  assert.equal(partial.recoveryCopies.length, 1);
  assert.equal(partial.errors.length, 1);
  const reverse = await readRecoveryData(async () => raw, async () => { throw new Error("Unavailable"); });
  assert.deepEqual(reverse.rawState, raw);
  assert.equal(reverse.errors.length, 1);
  assert.deepEqual(parseBackup(serializeBackup(copies[0].state)), prepareLoadedState(copies[0].state));
});

test("full backups above the former 10 MB limit round-trip; over-limit exports fail clearly", () => {
  const state = defaultState(); state.coachProfile = "x".repeat(11 * 1024 * 1024);
  const text = serializeBackup(state);
  assert.equal(parseBackup(text).coachProfile.length, state.coachProfile.length);
  assert.throws(() => parseBackup("x".repeat(MAX_BACKUP_BYTES + 1)), /too large/);
  state.coachProfile = "x".repeat(MAX_BACKUP_BYTES);
  assert.throws(() => serializeBackup(state), /too large/);
});

test("coverage window and source details both advance at midnight and resolve aliases", () => {
  const state = defaultState(), workout = makeWorkout("lb", 120);
  workout.status = "completed"; workout.date = "2026-09-27";
  const exercise = workout.exercises[0]; exercise.name = "My bench";
  exercise.sets = [makeSet("lb", { completed: true, actualReps: "6", actualWeight: 100, loadType: "weighted" })];
  state.exerciseAliases = { "My bench": "Bench press" }; state.workouts = [workout];
  assert.equal(coverageForLastDays(state, 7, "2026-10-03").find(m => m.muscle === "Chest")?.effectiveSets, 1);
  assert.equal(coverageSources(state, "Chest", 7, "2026-10-03")[0].effective, 1);
  assert.equal(coverageForLastDays(state, 7, "2026-10-04").find(m => m.muscle === "Chest")?.effectiveSets, 0);
  assert.equal(coverageSources(state, "Chest", 7, "2026-10-04").length, 0);
  exercise.sets[0].warmup = true;
  assert.equal(coverageSources(state, "Chest", 7, "2026-10-03").length, 0);
});
