import test from "node:test";
import assert from "node:assert/strict";
import { currentCoachCheckIn, defaultState, makeWorkout, makeSet, makeCardio, localDate, type CoachOptions } from "../app/training-types";
import { canonicalExerciseName, completedSetValues, completedActivityValues, performedReps, performedWeight, performedDuration, estimatedOneRepMax, formatPerformedSet, strengthRecords, workoutLiftingVolume } from "../app/training-metrics";
import { buildExerciseTrends, dateInWindow, localDateDaysEarlier } from "../app/training-insights";
import { mergeRestoredState, mergeTrainingStates } from "../app/cloud-sync";
import { parseFitlog } from "../app/fitlog";
import { coverageForLastDays, targetForCoverage, activityBreakdownForLastDays, exerciseMappingEntries, normalizeExerciseMuscleOverrides } from "../app/training-coverage";
import { coverageColor } from "../app/body-coverage-map";
import { exportCompletedHistory } from "../app/history-export";
import { buildCoachPrompt, buildQuickTrainingExtract, DEFAULT_COACH_PROFILE } from "../app/coach-export";
import { FITLOG_INSTRUCTIONS } from "../app/fitlog";
import { csvCell, neutralizeCsvCell } from "../app/csv-export";
import { activityRows } from "../app/training-workflow";

test("CSV export neutralizes spreadsheet formulas while preserving normal text", () => {
  assert.equal(neutralizeCsvCell("=HYPERLINK(\"https://example.test\")"), "'=HYPERLINK(\"https://example.test\")");
  assert.equal(neutralizeCsvCell("  +123"), "'  +123");
  assert.equal(neutralizeCsvCell("Bench press"), "Bench press");
  assert.equal(csvCell('He said "done"'), '"He said ""done"""');
});

test("restoring an older backup preserves newer local edits and deleted-workout tombstones", () => {
  const current = defaultState();
  const original = makeWorkout("lb", 90);
  original.status = "completed";
  original.createdAt = "2026-09-20T10:00:00.000Z";
  original.updatedAt = "2026-09-22T10:00:00.000Z";
  original.exercises[0].updatedAt = original.updatedAt;
  original.exercises[0].sets[0].actualWeight = 185;
  original.exercises[0].sets[0].actualReps = "6";
  original.exercises[0].sets[0].updatedAt = original.updatedAt;

  current.workouts = [structuredClone(original)];
  const newerSetEdit = current.workouts[0].exercises[0].sets[0];
  newerSetEdit.actualWeight = 190;
  newerSetEdit.updatedAt = "2026-09-23T10:00:00.000Z";
  current.workouts[0].exercises[0].updatedAt = newerSetEdit.updatedAt;
  current.workouts[0].updatedAt = newerSetEdit.updatedAt;
  current.deletedWorkoutIds = ["deleted-after-backup"];
  current.coachProfileUpdatedAt = "2026-09-23T10:00:00.000Z";
  current.goalsUpdatedAt = "2026-09-23T10:00:00.000Z";

  const backup = defaultState();
  backup.coachProfile = "Use durable preferences from this backup";
  backup.goals = ["Continue the saved long-term goal"];
  backup.coachProfileUpdatedAt = "2026-09-20T10:00:00.000Z";
  backup.goalsUpdatedAt = "2026-09-20T10:00:00.000Z";
  const staleWorkout = structuredClone(original);
  staleWorkout.id = "deleted-after-backup";
  staleWorkout.updatedAt = "2026-09-20T10:00:00.000Z";
  staleWorkout.exercises[0].updatedAt = staleWorkout.updatedAt;
  staleWorkout.exercises[0].sets[0].updatedAt = staleWorkout.updatedAt;
  backup.workouts = [staleWorkout, original];
  const backupOnlyWorkout = makeWorkout("lb", 90);
  backupOnlyWorkout.status = "completed";
  backup.workouts.push(backupOnlyWorkout);

  const merged = mergeRestoredState(current, backup);
  assert.deepEqual(merged.deletedWorkoutIds, ["deleted-after-backup"]);
  assert.ok(!merged.workouts.some((workout) => workout.id === "deleted-after-backup"));
  assert.equal(merged.workouts.find((workout) => workout.id === original.id)?.exercises[0].sets[0].actualWeight, 190);
  assert.ok(merged.workouts.some((workout) => workout.id === backupOnlyWorkout.id));
  assert.equal(merged.coachProfile, current.coachProfile);
  assert.deepEqual(merged.goals, current.goals);
});

test("client-shipped coaching defaults contain no personal athlete profile or goals", () => {
  const state = defaultState();
  assert.deepEqual(state.goals, []);
  assert.doesNotMatch(DEFAULT_COACH_PROFILE, /private name|private address|private email/i);
});

test("quick chat copies include only completed sessions in the chosen local date range", () => {
  const state = defaultState();
  state.goals = ["Bench 200×5"];
  const yesterday = makeWorkout("lb", 90, "Yesterday lift");
  yesterday.date = "2026-09-26";
  yesterday.status = "completed";
  yesterday.exercises[0].sets = [makeSet("lb", { completed: true, actualWeight: 175, actualReps: "5", loadType: "weighted", notes: "Clean reps" })];
  const today = makeWorkout("lb", 90, "Today lift");
  today.date = "2026-09-27";
  today.status = "completed";
  today.exercises[0].sets = [makeSet("lb", { completed: true, actualWeight: 185, actualReps: "6", loadType: "weighted" })];
  const plan = makeWorkout("lb", 90, "Unfinished plan");
  plan.status = "planned";
  state.workouts = [yesterday, today, plan];
  assert.match(buildQuickTrainingExtract(state, "last", "2026-09-27"), /Today lift/);
  assert.doesNotMatch(buildQuickTrainingExtract(state, "last", "2026-09-27"), /Yesterday lift|Unfinished plan|Bench 200/);
  assert.doesNotMatch(buildQuickTrainingExtract(state, "today", "2026-09-27"), /Yesterday lift/);
  const twoDays = buildQuickTrainingExtract(state, "two-days", "2026-09-27");
  assert.match(twoDays, /Yesterday lift[\s\S]*Clean reps[\s\S]*Today lift/);
  assert.doesNotMatch(twoDays, /Unfinished plan|GOALS|FITLOG/);
  assert.match(FITLOG_INSTRUCTIONS, /\[FITLOG:1\]/);
});

test("completing gray prescriptions commits reps/load, including effort-only edits", () => {
  for (const rpe of ["", "8"]) {
    const set = makeSet("lb", { plannedReps: "10", plannedWeight: 175, rpe });
    const completed = { ...set, ...completedSetValues(set), completed: true };
    assert.equal(performedReps(completed), "10");
    assert.equal(performedWeight(completed), 175);
  }
});

test("partly edited activities accept each untouched gray metric independently", () => {
  const activity = { ...makeCardio("bike"), plannedDurationMin: 8, plannedDistanceKm: 3, actualDistanceKm: 4, effort: "6" };
  const completed = { ...activity, ...completedActivityValues(activity), completed: true };
  assert.equal(performedDuration(completed), 8);
  assert.equal(completed.actualDistanceKm, 4);
});

test("bodyweight pull-up reps survive added-load sessions as separate trends", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 90);
  workout.status = "completed";
  workout.exercises[0].name = "Pull-Up";
  workout.exercises[0].sets = [
    makeSet("lb", { completed: true, actualReps: "13", loadType: "bodyweight" }),
    makeSet("lb", { completed: true, actualReps: "5", actualWeight: 45, loadType: "weighted", weightMode: "added" }),
  ];
  state.workouts = [workout];
  const trends = buildExerciseTrends(state);
  assert.equal(trends.find((trend) => trend.metric === "reps")?.points[0].value, 13);
  assert.equal(trends.find((trend) => trend.name.endsWith("added load"))?.points[0].value, 45);
  assert.ok(trends.every((trend) => trend.metric !== "e1rm"));
});

test("exercise aliases join trends without combining per-hand and total loads", () => {
  const state = defaultState();
  state.exerciseAliases = { "DB Bench": "Dumbbell Bench Press" };
  state.workouts = ["DB Bench", "Dumbbell Bench Press"].map((name, i) => {
    const workout = makeWorkout("lb", 90); workout.status = "completed";
    workout.exercises[0].name = name;
    workout.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "8", actualWeight: i ? 100 : 50, loadType: "weighted", weightMode: i ? "total" : "per_hand" })];
    return workout;
  });
  const trends = buildExerciseTrends(state);
  assert.equal(trends.length, 2);
  assert.ok(trends.every((trend) => trend.name.startsWith("Dumbbell Bench Press")));
});

test("weekly dates mean seven calendar dates, excluding future sessions", () => {
  assert.equal(dateInWindow("2026-09-16", 7, "2026-09-22"), true);
  assert.equal(dateInWindow("2026-09-15", 7, "2026-09-22"), false);
  assert.equal(dateInWindow("2026-09-23", 7, "2026-09-22"), false);
});

test("e1RM rejects high reps and leg curls map to hamstrings", () => {
  assert.equal(estimatedOneRepMax(100, 20), null);
  assert.ok(targetForCoverage("Seated Leg Curl")?.primary.includes("Hamstrings"));
  assert.ok(!targetForCoverage("Seated Leg Curl")?.primary.includes("Biceps"));
});

test("recent e1RM stays at the demonstrated top set after an easier session", () => {
  const state = defaultState();
  state.workouts = [["2026-09-01", 205, "6"], ["2026-09-15", 155, "5"]].map(([date, weight, reps]) => {
    const workout = makeWorkout("lb", 90);
    workout.status = "completed";
    workout.date = date as string;
    workout.exercises[0].name = "Barbell Bench Press";
    workout.exercises[0].sets = [makeSet("lb", { completed: true, actualWeight: weight as number, actualReps: reps as string, loadType: "weighted", weightMode: "total" })];
    return workout;
  });
  const trend = buildExerciseTrends(state).find((item) => item.name === "Barbell Bench Press");
  assert.ok(trend);
  assert.equal(trend.points[1].value, trend.points[0].value);
  assert.match(trend.points[1].setLabel, /^Recent best:/);
});

test("records use actual singles, aliases stay canonical, and trend dimensions stay separate", () => {
  assert.equal(canonicalExerciseName("Bench", { bench: "BB Bench", "bb bench": "Barbell Bench Press" }), "Barbell Bench Press");
  const state = defaultState();
  const workout = makeWorkout("lb", 90);
  workout.status = "completed";
  workout.exercises[0].name = "Bench";
  workout.exercises[0].sets = [
    makeSet("lb", { completed: true, plannedWeight: 135, actualWeight: 225, actualReps: "1", loadType: "weighted", weightMode: "total" }),
    makeSet("lb", { completed: true, actualWeight: 100, actualReps: "8", loadType: "weighted", weightMode: "per_hand" }),
  ];
  state.exerciseAliases = { bench: "BB Bench", "bb bench": "Barbell Bench Press" };
  state.workouts = [workout];
  assert.equal(strengthRecords(state, "lb").get("Barbell Bench Press")?.weight, 225);
  const trends = buildExerciseTrends(state);
  assert.equal(trends.length, 2);
  assert.notEqual(trends[0].key, trends[1].key);
  assert.ok(trends.every((series) => series.name.startsWith("Barbell Bench Press")));
});

test("coverage requires positive reps, uses set volume for color, and local windows exclude future records", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 90);
  workout.status = "completed";
  workout.date = localDate();
  workout.exercises[0].name = "Barbell Bench Press";
  workout.exercises[0].sets = [makeSet("lb", { completed: true, actualWeight: 135, actualReps: "0", loadType: "weighted" })];
  state.workouts = [workout];
  assert.equal(coverageForLastDays(state).find((entry) => entry.muscle === "Chest")?.effectiveSets, 0);
  assert.equal(coverageColor({ muscle: "Chest", effectiveSets: 5, days: 1 }), coverageColor({ muscle: "Chest", effectiveSets: 5, days: 3 }));
  assert.equal(targetForCoverage("Hamstring Curl")?.primary[0], "Hamstrings");
  const future = structuredClone(workout);
  future.id = "future";
  future.date = "2999-01-01";
  future.exercises[0].sets[0].actualReps = "5";
  state.workouts.push(future);
  assert.equal(buildExerciseTrends(state).length, 0);
  assert.equal(dateInWindow(localDateDaysEarlier(6, "2026-09-22"), 7, "2026-09-22"), true);
});

test("bodyweight sync unions dates and uses latest measurement on conflicts", () => {
  const local = defaultState(), remote = defaultState();
  local.bodyweightEntries = [{ id: "a", date: "2026-09-20", weight: 182, unit: "lb", updatedAt: "2026-09-20" }];
  remote.bodyweightEntries = [{ id: "b", date: "2026-09-21", weight: 80, unit: "kg", updatedAt: "2026-09-21" }, { id: "c", date: "2026-09-20", weight: 178, unit: "lb", updatedAt: "2026-09-22" }];
  const merged = mergeTrainingStates(local, remote);
  assert.equal(merged.bodyweightEntries.length, 2);
  assert.equal(merged.bodyweightEntries[0].weight, 178);
  assert.equal(merged.bodyweightEntries[1].unit, "kg");
});

test("profile, goals, and settings use their newest section revision across devices", () => {
  const local = defaultState();
  const remote = defaultState();
  local.goals = ["Phone goal"];
  local.goalsUpdatedAt = "2026-09-20T10:00:00.000Z";
  remote.goals = ["Laptop goal"];
  remote.goalsUpdatedAt = "2026-09-21T10:00:00.000Z";
  local.coachProfile = "Older profile";
  local.coachProfileUpdatedAt = "2026-09-20T10:00:00.000Z";
  remote.coachProfile = "Newer profile";
  remote.coachProfileUpdatedAt = "2026-09-21T10:00:00.000Z";
  local.settings.defaultRestSec = 90;
  local.settingsUpdatedAt = "2026-09-22T10:00:00.000Z";
  remote.settings.defaultRestSec = 120;
  remote.settingsUpdatedAt = "2026-09-21T10:00:00.000Z";

  const merged = mergeTrainingStates(local, remote);
  assert.deepEqual(merged.goals, ["Laptop goal"]);
  assert.equal(merged.coachProfile, "Newer profile");
  assert.equal(merged.settings.defaultRestSec, 90);
});

test("deleted workouts and nested entries stay deleted after stale sync", () => {
  const local = defaultState(), remote = defaultState();
  const workout = makeWorkout("lb", 90);
  workout.status = "completed";
  workout.cardio = [makeCardio("bike")];
  remote.workouts = [structuredClone(workout)];
  const exercise = workout.exercises[0];
  exercise.deletedSetIds = [exercise.sets[0].id];
  exercise.sets = exercise.sets.slice(1);
  workout.deletedActivityIds = [workout.cardio[0].id]; workout.cardio = [];
  local.workouts = [workout];
  let merged = mergeTrainingStates(local, remote);
  assert.ok(!merged.workouts[0].exercises[0].sets.some((set) => exercise.deletedSetIds?.includes(set.id)));
  assert.equal(merged.workouts[0].cardio.length, 0);
  workout.deletedExerciseIds = [exercise.id]; workout.exercises = [];
  merged = mergeTrainingStates(local, remote);
  assert.equal(merged.workouts[0].exercises.length, 0);
  workout.status = "active"; local.activeWorkoutId = workout.id;
  remote.deletedWorkoutIds = [workout.id];
  merged = mergeTrainingStates(local, remote);
  assert.equal(merged.workouts.length, 0);
  assert.equal(merged.activeWorkoutId, null);
});

test("parser preserves block order, compact units, added loads, and minute rest", () => {
  const workout = parseFitlog(`[FITLOG:1]\nWORKOUT|QA|2026-09-22\nCARDIO|Warmup bike\nDURATION|8\nEXERCISE|Pull-Up\nSET|5|Bodyweight + 45lb|RPE 8\nREST|2min\nMOBILITY|Recovery\nMOVE|Calf stretch|30 sec/side\n[/FITLOG]`, "kg", {});
  assert.deepEqual(workout.blockOrder.map((block) => block.type), ["activity", "exercise", "activity"]);
  assert.equal(workout.exercises[0].sets[0].unit, "lb");
  assert.equal(workout.exercises[0].sets[0].weightMode, "added");
  assert.equal(workout.exercises[0].restSec, 120);
  assert.ok(!workout.importWarnings?.some((warning) => warning.includes("Unitless")));
});

test("FITLOG rejects ambiguous values and incomplete workout structures", () => {
  assert.throws(
    () => parseFitlog(`[FITLOG:1]
WORKOUT|Effort|2026-09-22
EXERCISE|Bench Press
SET|5|175 lb|8
[/FITLOG]`, "lb", {}),
    /SET effort: use RPE/i,
  );
  assert.throws(
    () => parseFitlog(`[FITLOG:1]
WORKOUT|Ruck|2026-09-22
CARDIO|Ruck
TYPE|ruck
RUCKLOAD|45
[/FITLOG]`, "kg", {}),
    /RUCKLOAD: use a non-negative number with lb or kg/i,
  );
  const clearTargets = parseFitlog(`[FITLOG:1]
WORKOUT|Clear targets|2026-09-22
EXERCISE|Bench Press
SET|5|175 lb|RPE 7-8
CARDIO|Ruck
RUCKLOAD|45 lb
[/FITLOG]`, "kg", {});
  assert.equal(clearTargets.exercises[0].sets[0].plannedRpe, "7-8");
  assert.equal(clearTargets.cardio[0].ruckLoadUnit, "lb");
  assert.throws(
    () => parseFitlog(`[FITLOG:1]
WORKOUT|Ambiguous load|2026-09-22
EXERCISE|Barbell Bench Press
SET|5|2 x 20 kg||
[/FITLOG]`, "kg", {}),
    /SET: use Bodyweight or a load/i,
  );
  assert.throws(
    () => parseFitlog(`[FITLOG:1]
WORKOUT|First|2026-09-22
EXERCISE|Barbell Bench Press
SET|5|100 kg||
WORKOUT|Second|2026-09-23
[/FITLOG]`, "kg", {}),
    /exactly one WORKOUT/i,
  );
  assert.throws(
    () => parseFitlog(`[FITLOG:1]
WORKOUT|Invalid date|2026-02-30
EXERCISE|Barbell Bench Press
SET|5|100 kg||
[/FITLOG]`, "kg", {}),
    /valid calendar date/i,
  );
  assert.throws(
    () => parseFitlog(`[FITLOG:1]
WORKOUT|No set|2026-09-22
EXERCISE|Barbell Bench Press
[/FITLOG]`, "kg", {}),
    /has no SET lines/i,
  );
  assert.throws(
    () => parseFitlog(`[FITLOG:1]
WORKOUT|One|2026-09-22
EXERCISE|Barbell Bench Press
SET|5|100 kg||
[/FITLOG]
[FITLOG:1]
WORKOUT|Two|2026-09-23
EXERCISE|Barbell Bench Press
SET|5|100 kg||
[/FITLOG]`, "kg", {}),
    /exactly one complete FITLOG/i,
  );
});

test("FITLOG accepts clock-style rest without inventing a numeric value", () => {
  const workout = parseFitlog(`[FITLOG:1]
WORKOUT|Clock rest|2026-09-22
EXERCISE|Barbell Bench Press
SET|5|100 kg||
REST|1:30
[/FITLOG]`, "kg", {});
  assert.equal(workout.exercises[0].restSec, 90);
});

test("completed warm-ups remain labeled in exported workout context", () => {
  const warmup = makeSet("lb", { completed: true, completedAsPlanned: true, warmup: true, plannedReps: "8", plannedWeight: 135, loadType: "weighted" });
  assert.match(formatPerformedSet(warmup), /warm-up/);
});

test("FITLOG activity targets remain coach guidance rather than recorded measurements", () => {
  const workout = parseFitlog(`[FITLOG:1]
WORKOUT|Run targets|2026-09-22
CARDIO|Tempo run
TYPE|run
DURATION|30
HR|155
ELEVATION|120
PACE|4:30/km
NOTES|Stay controlled.
[/FITLOG]`, "kg", {});
  const activity = workout.cardio[0];
  assert.equal(activity.averageHr, null);
  assert.equal(activity.elevationM, null);
  assert.equal(activity.pace, "");
  assert.match(activity.coachNotes, /Target average HR: 155 bpm\. Target total ascent: 120 m\. Target pace: 4:30\/km\. Stay controlled\./);
});

test("coach readiness is dated and since-brief exports include later corrections and active context", () => {
  assert.equal(currentCoachCheckIn({ date: "2026-09-20", energy: "8", sleep: "8 h", soreness: "Low", restrictions: "", schedule: "" }, "2026-09-21").energy, "");
  const state = defaultState();
  const corrected = makeWorkout("lb", 90, "Corrected bench");
  corrected.status = "completed";
  corrected.date = "2026-09-10";
  corrected.updatedAt = "2026-09-21T12:00:00.000Z";
  const active = makeWorkout("lb", 90, "Still training");
  active.status = "active";
  active.exercises[0].sets[0].completed = true;
  state.workouts = [corrected, active];
  state.activeWorkoutId = active.id;
  const prompt = buildCoachPrompt(state, { mode: "continue", days: 7, since: "2026-09-20", sinceAt: "2026-09-20T12:00:00.000Z", energy: "", sleep: "", soreness: "", timeAvailable: "", equipment: "", restrictions: "", schedule: "", request: "" });
  assert.match(prompt, /Corrected bench/);
  assert.match(prompt, /ACTIVE SESSION — IN PROGRESS, NOT YET COMPLETED[\s\S]*Still training/);
});

test("completed-only history excludes notes/skips and reads materialized activity results", () => {
  const state = defaultState(), workout = makeWorkout("lb", 90);
  workout.status = "completed"; workout.notes = "PRIVATE NOTE";
  workout.exercises = [];
  const plannedRun = { ...makeCardio("run"), plannedDurationMin: 30, plannedDistanceKm: 5 };
  workout.cardio = [{ ...plannedRun, ...completedActivityValues(plannedRun), completed: true }];
  state.workouts = [workout, { ...workout, id: "skip", name: "SKIPPED NAME", status: "skipped" }];
  const exported = exportCompletedHistory(state);
  assert.match(exported, /5 km.*30 min/);
  assert.doesNotMatch(exported, /PRIVATE NOTE|SKIPPED NAME/);
  workout.cardio.push({ ...makeCardio("run"), actualDurationMin: 10, actualDistanceKm: 2, completed: false });
  assert.equal(activityBreakdownForLastDays(state, "lb").runs.minutes, 30);
});

test("FORCE and circuit activities stay in their own history and weekly totals", () => {
  const state = defaultState();
  const workout = makeWorkout("lb", 90, "FORCE test circuit");
  workout.date = localDate();
  workout.status = "completed";
  workout.cardio = [
    { ...makeCardio("force"), completed: true, actualDurationMin: 30 },
    { ...makeCardio("circuit"), completed: true, actualDurationMin: 12 },
    { ...makeCardio("other"), completed: true, actualDurationMin: 5 },
  ];
  state.workouts = [workout];
  assert.equal(activityRows(state, "force").length, 1);
  assert.equal(activityRows(state, "circuit").length, 1);
  assert.equal(activityRows(state, "other").length, 1);
  assert.equal(activityBreakdownForLastDays(state, "lb").circuits.minutes, 12);
  assert.equal(activityBreakdownForLastDays(state, "lb").circuits.sessions, 1);
  workout.cardio = workout.cardio.filter((activity) => activity.activityType !== "circuit");
  workout.exercises[0].sets[0].completed = true;
  assert.equal(activityBreakdownForLastDays(state, "lb").circuits.sessions, 0);
});

test("continuing briefs are shorter and include dated bodyweight and future schedule", () => {
  const state = defaultState();
  state.bodyweightEntries = [{ id: "bw", date: localDate(), weight: 182, unit: "lb", updatedAt: new Date().toISOString() }];
  state.scheduleContext.events = [{ id: "pt", date: "2099-01-01", label: "Future ruck" }];
  const options: CoachOptions = { mode: "continue", days: 7, energy: "", sleep: "", soreness: "", timeAvailable: "", equipment: "", restrictions: "", schedule: "", request: "" };
  const continued = buildCoachPrompt(state, options);
  assert.match(continued, /182 lb/);
  assert.match(continued, /2099-01-01: Future ruck/);
  assert.match(continued, /Other PT \/ schedule in the next 48 hours: Not provided/);
  assert.doesNotMatch(continued, /Not provided\/10/);
  assert.ok(continued.length < buildCoachPrompt(state, { ...options, mode: "new" }).length);
});


test("muscle review includes saved and automatic exercises and preserves every muscle through sync/reset", () => {
  const state = defaultState();
  const plan = parseFitlog(`[FITLOG:1]
WORKOUT|Mapping review|2026-09-24
EXERCISE|Barbell Bench Press
SET|5|175 lb||
EXERCISE|Unusual movement
SET|8|20 lb||
[/FITLOG]`, "lb", {});
  state.workouts = [plan];
  const initial = exerciseMappingEntries(state);
  assert.equal(initial.length, 2);
  assert.equal(initial.every((entry) => !entry.reviewed), true);
  assert.deepEqual(initial[0].target?.secondary, ["Triceps", "Front delts"]);
  assert.equal(initial[1].target, null);
  state.exerciseMuscleOverrides = normalizeExerciseMuscleOverrides({
    "barbell bench press": { primary: ["Chest", "Triceps"], secondary: ["Front delts", "Side delts"], updatedAt: "2026-09-24T10:00:00.000Z" }
  });
  const synced = mergeTrainingStates(state, defaultState());
  const reviewed = exerciseMappingEntries(synced)[0];
  assert.equal(reviewed.reviewed, true);
  assert.deepEqual(reviewed.target?.primary, ["Chest", "Triceps"]);
  assert.deepEqual(reviewed.target?.secondary, ["Front delts", "Side delts"]);
  const stale = structuredClone(synced);
  synced.exerciseMuscleOverrides["barbell bench press"] = { primary: [], updatedAt: "2026-09-24T11:00:00.000Z", deletedAt: "2026-09-24T11:00:00.000Z" };
  const reset = exerciseMappingEntries(mergeTrainingStates(synced, stale))[0];
  assert.equal(reset.reviewed, false);
  assert.deepEqual(reset.target?.primary, ["Chest"]);
  assert.deepEqual(reset.target?.secondary, ["Triceps", "Front delts"]);
});


test("workout volume counts exact completed load and handles units, paired dumbbells and exclusions", () => {
  const workout = parseFitlog(`[FITLOG:1]
WORKOUT|Volume|2026-09-24
EXERCISE|Bench Press
SET|5|100 lb||
SET|5|100 lb||WARMUP
SET|8-10|100 lb||
SET|5|100 lb||
EXERCISE|Dumbbell Press
SET|10|20 kg each||
EXERCISE|Pull-Up
SET|5|Bodyweight||
SET|5|Bodyweight + 45 lb||
[/FITLOG]`, "lb", {});
  workout.exercises.forEach((exercise) => exercise.sets.forEach((set) => {
    set.completed = true;
    // A legacy saved range remains excluded from volume. New completions require actual reps.
    if (set.plannedReps === "8-10") set.actualReps = "8-10";
    else Object.assign(set, completedSetValues(set));
  }));
  workout.exercises[0].sets[3].completed = false;
  const totals = workoutLiftingVolume(workout, "lb");
  assert.ok(Math.abs(totals.volume - (500 + 400 * 2.2046226218 + 225)) < 0.001);
  assert.equal(totals.countedSets, 3);
  assert.equal(totals.excludedSets, 2);
});
