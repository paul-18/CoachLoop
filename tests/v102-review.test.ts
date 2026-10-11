import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UNUSUAL_ENTRY_MESSAGE, unusualActivityWarning, unusualSaveLabel, unusualWorkoutWarning } from "../app/domain/activity-plausibility";
import { activityHistoryLabel, exerciseSetProgress } from "../app/domain/completion";
import { weeklyCards } from "../app/domain/weekly-cards";
import { defaultState, localDate, makeCardio, makeSet, makeWorkout } from "../app/domain/training-types";
import { goalListKey } from "../app/views/goal-examples";
import { ActivityBreakdown } from "../app/views/progress-view";
import { HistoryView } from "../app/views/history-view";
import { TodayView } from "../app/views/today-view";
import { DemoBar } from "../app/views/demo-bar";
import { SampleWorkoutPreview } from "../app/views/sample-workout";
import { WorkoutEditor } from "../app/views/workout-editor";
import { countLabel, summarizeWorkout } from "../app/views/shared";
import { exampleSetupState } from "../app/views/starter-plan";

const clone = <T,>(value: T): T => structuredClone(value);

test("a nonzero distance with zero minutes warns and does not change the entry", () => {
  const activity = { ...makeCardio("run"), completed: true, actualDistanceKm: 203, actualDurationMin: 0 };
  const before = clone(activity);
  const warning = unusualActivityWarning(activity);
  assert.match(warning ?? "", /203 km in 0 min/);
  assert.match(warning ?? "", new RegExp(UNUSUAL_ENTRY_MESSAGE));
  assert.deepEqual(activity, before);
  assert.equal(unusualSaveLabel(warning, false, "Finish workout"), "Save unusual entry");
  assert.equal(unusualSaveLabel(null, false, "Finish workout"), "Finish workout");
  assert.equal(unusualSaveLabel(warning, true, "Finish workout"), "Saving…");
});

test("an absurd pace warns, and a normal run, bike and ruck do not", () => {
  const absurd = { ...makeCardio("run"), completed: true, actualDistanceKm: 10, actualDurationMin: 1 };
  assert.match(unusualActivityWarning(absurd) ?? "", /unusual/);
  const fastFiveK = { ...makeCardio("run"), completed: true, actualDistanceKm: 5, actualDurationMin: 16 };
  assert.equal(unusualActivityWarning(fastFiveK), null);
  for (const [type, distance, minutes] of [["run", 5, 30], ["bike", 20, 45], ["ruck", 5, 60]] as const) {
    assert.equal(unusualActivityWarning({ ...makeCardio(type), completed: true, actualDistanceKm: distance, actualDurationMin: minutes }), null, type);
  }
});

test("distance warnings use metres for swim and row and ignore lb or kg labels", () => {
  const sprint = { ...makeCardio("swim"), completed: true, actualDistanceKm: 0.1, actualDurationMin: 0 };
  assert.match(unusualActivityWarning(sprint) ?? "", /100 m in 0 min/);
  assert.doesNotMatch(unusualActivityWarning(sprint) ?? "", /km/);
  const steady = { ...makeCardio("row"), completed: true, actualDistanceKm: 2, actualDurationMin: 10 };
  assert.equal(unusualActivityWarning(steady), null);
  for (const unit of ["lb", "kg"] as const) {
    const ruck = { ...makeCardio("ruck"), completed: true, actualDistanceKm: 203, actualDurationMin: 0, ruckLoad: unit === "lb" ? 45 : 20, ruckLoadUnit: unit };
    const before = clone(ruck);
    const warning = unusualActivityWarning(ruck) ?? "";
    assert.match(warning, /203 km/);
    assert.doesNotMatch(warning, /lb|kg/);
    assert.deepEqual(ruck, before);
    assert.equal(unusualActivityWarning({ ...ruck, actualDistanceKm: 5, actualDurationMin: 60 }), null);
  }
});

test("the workout editor shows the unusual-entry warning without rewriting the workout", () => {
  const workout = makeWorkout("lb", 60, "Run session");
  const run = { ...makeCardio("run"), completed: true, actualDistanceKm: 203, actualDurationMin: 0 };
  workout.exercises = [];
  workout.cardio = [run];
  workout.blockOrder = [{ type: "activity", id: run.id }];
  const before = clone(workout);
  const markup = renderToStaticMarkup(createElement(WorkoutEditor, {
    workout, state: defaultState(), saveStatus: "saved", onUpdate: () => {}, onFinish: async () => {}, onBack: () => {}, onIncrement: () => {},
  }));
  assert.match(markup, /203 km in 0 min/);
  assert.match(markup, /That distance and duration look unusual/);
  assert.equal(unusualWorkoutWarning(workout), unusualActivityWarning(run));
  assert.deepEqual(workout, before);
});

test("history counts completed work, skips, and singular labels the same way as the header", () => {
  const workout = makeWorkout("lb", 60);
  workout.status = "completed";
  workout.exercises[0].sets = [
    makeSet("lb", { completed: true, actualReps: "5", actualWeight: 100 }),
    makeSet("lb", { completed: true, skipped: true, actualReps: "5", actualWeight: 100 }),
    makeSet("lb", { skipped: true }),
  ];
  assert.equal(summarizeWorkout(workout), "1 exercise · 1 completed set");
  assert.deepEqual(exerciseSetProgress(workout.exercises[0].sets), { done: 1, total: 2, skippedOnly: false });
  const only = makeWorkout("lb", 60);
  only.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "8", actualWeight: 40 })];
  assert.equal(summarizeWorkout(only), "1 exercise · 1 completed set");
  assert.equal(exerciseSetProgress(only.exercises[0].sets).total, 1);
  const many = makeWorkout("lb", 60);
  many.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5" }), makeSet("lb", { completed: true, actualReps: "5" })];
  assert.match(summarizeWorkout(many), /2 completed sets/);
  const empty = makeWorkout("lb", 60);
  assert.equal(summarizeWorkout(empty), "No work recorded");
  const skippedActivity = { ...makeCardio("bike"), skipped: true, completed: false, actualDistanceKm: 203, actualDurationMin: 0 };
  const finishedActivity = { ...makeCardio("yoga"), completed: true };
  const openActivity = makeCardio("run");
  const cardio = makeWorkout("lb", 60);
  cardio.exercises = [];
  cardio.cardio = [skippedActivity, finishedActivity, openActivity];
  assert.equal(summarizeWorkout(cardio), "1 activity");
  assert.equal(activityHistoryLabel(skippedActivity), "Skipped");
  assert.equal(activityHistoryLabel(finishedActivity), "Completed");
  assert.equal(activityHistoryLabel(openActivity), "Not completed");
  const legacy = makeCardio("run");
  delete legacy.skipped;
  assert.equal(activityHistoryLabel(legacy), "Not completed");
  assert.equal(countLabel(1, "planned set"), "1 planned set");
  assert.equal(countLabel(1, "session"), "1 session");
  assert.equal(countLabel(3, "set"), "3 sets");
});

test("last session is not shown beside no previous result", () => {
  const prior = makeWorkout("lb", 60);
  prior.status = "completed";
  prior.date = "2020-01-01";
  prior.completedAt = "2020-01-01T12:00:00.000Z";
  prior.exercises[0].sets = [makeSet("lb", { completed: true, warmup: true, actualReps: "10", actualWeight: 45 })];
  const current = makeWorkout("lb", 60);
  const state = defaultState();
  state.workouts = [prior, current];
  const markup = renderToStaticMarkup(createElement(WorkoutEditor, {
    workout: current, state, saveStatus: "saved", onUpdate: () => {}, onFinish: async () => {}, onBack: () => {}, onIncrement: () => {},
  }));
  assert.match(markup, /Last session/);
  assert.doesNotMatch(markup, /No previous result/);
});

test("the first-workout note is on History when it is due, and absent after Got it", () => {
  const showing = defaultState();
  showing.settings.firstWorkoutNote = "show";
  const visible = renderToStaticMarkup(createElement(HistoryView, {
    state: showing, onEdit: () => {}, onRepeat: () => {}, onReplan: () => {}, onDelete: () => {}, onDismissFirstNote: () => {},
  }));
  assert.match(visible, /Saved on this phone/);
  assert.match(visible, /Got it/);
  const dismissed = defaultState();
  dismissed.settings.firstWorkoutNote = "dismissed";
  const hidden = renderToStaticMarkup(createElement(HistoryView, {
    state: dismissed, onEdit: () => {}, onRepeat: () => {}, onReplan: () => {}, onDelete: () => {}, onDismissFirstNote: () => {},
  }));
  assert.doesNotMatch(hidden, /Saved on this phone/);
});

test("demo wording, sample preview, and Not now stay distinct", () => {
  const demo = renderToStaticMarkup(createElement(DemoBar, { onExit: () => {} }));
  assert.match(demo, /Demo mode/);
  assert.match(demo, /Changes are discarded when you exit or refresh/);
  assert.match(demo, /Exit demo/);
  assert.doesNotMatch(demo, /Preview one workout|See a sample workout/);
  const sample = renderToStaticMarkup(createElement(SampleWorkoutPreview, { unit: "lb", onClose: () => {} }));
  assert.match(sample, /planned sets/);
  assert.doesNotMatch(sample, /1 planned sets/);
  const today = renderToStaticMarkup(createElement(TodayView, {
    state: exampleSetupState(defaultState()),
    syncStatus: "synced",
    onHyrox: () => {},
    onStartBlank: () => {},
    onQuickCardio: () => {},
    onImport: () => {},
    onCoach: () => {},
    onResume: () => {},
    onStartPlan: () => {},
    onReschedulePlan: () => {},
    onSkipPlan: () => {},
    onHistory: () => {},
    onBodyweightLog: () => {},
    onTrainingCalendar: () => {},
    onDismissCoachingPrompt: () => {},
    onOpenCoachingPreferences: () => {},
  }));
  assert.match(today, /Set coaching preferences/);
  assert.match(today, /Not now/);
  assert.equal(exampleSetupState(defaultState()).settings.coachingPromptDismissed, undefined);
});

test("an empty last-seven-days hides zero cards, and a logged run keeps its card in kilograms", () => {
  const empty = renderToStaticMarkup(createElement(ActivityBreakdown, { state: defaultState() }));
  assert.match(empty, /Nothing in the last 7 days yet/);
  assert.doesNotMatch(empty, /0 km/);
  const state = defaultState();
  state.settings.defaultUnit = "kg";
  state.settings.weeklyCards = ["strength", "run"];
  const workout = makeWorkout("lb", 60);
  workout.status = "completed";
  workout.date = localDate();
  const set = workout.exercises[0].sets[0];
  set.completed = true;
  set.actualReps = "5";
  set.actualWeight = 100;
  set.loadType = "weighted";
  workout.exercises[0].sets = [set];
  const run = { ...makeCardio("run"), completed: true, actualDistanceKm: 5, actualDurationMin: 30 };
  workout.cardio = [run];
  workout.blockOrder = [...workout.blockOrder, { type: "activity" as const, id: run.id }];
  state.workouts = [workout];
  const cards = weeklyCards(state);
  assert.equal(cards.find(card => card.id === "strength")?.empty, false);
  assert.match(cards.find(card => card.id === "strength")?.value ?? "", /kg × reps/);
  assert.doesNotMatch(cards.find(card => card.id === "strength")?.value ?? "", /lb/);
  assert.match(cards.find(card => card.id === "strength")?.detail ?? "", /excludes bodyweight/);
  const markup = renderToStaticMarkup(createElement(ActivityBreakdown, { state }));
  assert.match(markup, /Runs/);
  assert.match(markup, /5 km/);
  assert.match(markup, /kg × reps/);
});

test("goal list keys follow the text when unique goals are reordered", () => {
  assert.equal(goalListKey(["Bench", "Run"], 0), "Bench");
  assert.equal(goalListKey(["Run", "Bench"], 1), "Bench");
  assert.notEqual(goalListKey(["Same", "Same"], 0), goalListKey(["Same", "Same"], 1));
});
