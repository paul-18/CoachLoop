import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkAttempts, benchmarkDueDate, pendingRetests } from "../app/domain/benchmarks";
import { weeklyTrainingSignals } from "../app/domain/training-snapshot";
import { defaultState, makeCardio, makeSet, makeWorkout, type PinnedBenchmark } from "../app/domain/training-types";
import { mergeTrainingStates } from "../app/persistence/cloud-sync";
import { prepareLoadedState } from "../app/persistence/migrations";
import { buildCoachPrompt } from "../app/interchange/coach-export";

const benchmark = (overrides: Partial<PinnedBenchmark> = {}): PinnedBenchmark => ({
  id: "five-k", name: "5K", protocol: "same route", result: "24:30",
  testedOn: "2026-09-01", retestDays: 30, updatedAt: "2026-09-01T12:00:00Z", ...overrides,
});

test("benchmark re-test dates cross months and only explicit recorded tests become due", () => {
  assert.equal(benchmarkDueDate(benchmark()), "2026-10-01");
  assert.equal(benchmarkDueDate(benchmark({ testedOn: null })), null);
  assert.equal(benchmarkDueDate(benchmark({ retestDays: null })), null);
  assert.deepEqual(pendingRetests([benchmark(), benchmark({ id: "deleted", deletedAt: "2026-09-02T00:00:00Z" })], "2026-09-27").map(({ item }) => item.id), ["five-k"]);
  assert.equal(pendingRetests([benchmark()], "2026-09-01").length, 0);
});

test("pinned benchmarks survive load and sync, with newer deletion winning", () => {
  const older = defaultState();
  older.benchmarks = [benchmark()];
  assert.equal(prepareLoadedState(older).benchmarks?.[0].result, "24:30");
  const newer = structuredClone(older);
  newer.benchmarks![0] = benchmark({ deletedAt: "2026-09-27T12:00:00Z", updatedAt: "2026-09-27T12:00:00Z" });
  const merged = mergeTrainingStates(older, newer);
  assert.equal(merged.benchmarks?.[0].deletedAt, "2026-09-27T12:00:00Z");
});

test("benchmark results preserve old tests and union independent device entries", () => {
  const base = defaultState();
  base.benchmarks = [benchmark()];
  const phone = structuredClone(base);
  phone.benchmarks![0] = benchmark({ result: "21:10", testedOn: "2026-09-20", updatedAt: "2026-09-20T12:00:00Z", attempts: [
    { id: "legacy-five-k-2026-09-01", date: "2026-09-01", result: "24:30", protocol: "same route", updatedAt: "2026-09-01T12:00:00Z" },
    { id: "phone", date: "2026-09-20", result: "21:10", protocol: "same route", updatedAt: "2026-09-20T12:00:00Z" },
  ] });
  const laptop = structuredClone(base);
  laptop.benchmarks![0] = benchmark({ result: "20:59", testedOn: "2026-09-27", updatedAt: "2026-09-27T12:00:00Z", attempts: [
    { id: "laptop", date: "2026-09-27", result: "20:59", protocol: "flat course", updatedAt: "2026-09-27T12:00:00Z" },
  ] });
  const merged = mergeTrainingStates(phone, laptop).benchmarks![0];
  assert.deepEqual(benchmarkAttempts(merged).map((entry) => entry.result), ["20:59", "21:10", "24:30"]);
  assert.equal(merged.testedOn, "2026-09-27");
  assert.equal(prepareLoadedState({ ...base, benchmarks: [merged] }).benchmarks?.[0].attempts?.length, 3);
});

test("weekly facts only report actual run/lift overlap", () => {
  const state = defaultState();
  const run = makeWorkout("lb", 90, "Tempo run");
  run.date = "2026-09-23"; run.status = "completed"; run.exercises = [];
  run.cardio = [{ ...makeCardio("run"), completed: true, intensity: "tempo" }];
  const lift = makeWorkout("lb", 90, "Squat");
  lift.date = "2026-09-24"; lift.status = "completed";
  lift.exercises[0].name = "Barbell Squat";
  lift.exercises[0].sets = [{ ...makeSet("lb"), completed: true, actualReps: "5" }];
  state.workouts = [run, lift];
  assert.deepEqual(weeklyTrainingSignals(state, "2026-09-27"), { loggedSessions: 2, overlap: true });
  lift.exercises[0].sets[0].warmup = true;
  assert.equal(weeklyTrainingSignals(state, "2026-09-27").overlap, false);
});

test("coach brief mentions recently due benchmark results without treating them as workouts", () => {
  const state = defaultState();
  state.benchmarks = [benchmark({ testedOn: "2026-09-01", retestDays: 30 })];
  const prompt = buildCoachPrompt(state, { mode: "continue", days: 14, energy: "", sleep: "", soreness: "", timeAvailable: "", equipment: "", restrictions: "", schedule: "", request: "" });
  assert.match(prompt, /PINNED BENCHMARKS/);
  assert.match(prompt, /5K \(same route\): 24:30 on 2026-09-01; re-test 2026-10-01/);
});
