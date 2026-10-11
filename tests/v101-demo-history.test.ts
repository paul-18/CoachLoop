import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildDemoState, projectDemoUpdate } from "../app/domain/demo-session";
import { coverageForLastDays, unmappedExerciseNamesLastDays } from "../app/domain/training-coverage";
import { defaultState } from "../app/domain/training-types";
import { validatedState } from "../app/persistence/training-validation";
import { prepareLoadedState } from "../app/persistence/migrations";
import { SampleWorkoutPreview } from "../app/views/sample-workout";
import { addSamplePlan, coachingPromptVisible, dismissCoachingPrompt, exampleSetupState, samplePlan } from "../app/views/starter-plan";

function daysBefore(today: string, days: number) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

test("demo history is a fresh two-week log relative to the date it is opened", () => {
  const today = "2026-10-11";
  const first = validatedState(buildDemoState(today));
  const second = validatedState(buildDemoState(today));
  const dates = first.workouts.map(workout => workout.date).sort();
  assert.ok(dates.every(date => date >= daysBefore(today, 13) && date <= today));
  assert.ok(dates.some(date => date <= daysBefore(today, 7)));
  assert.ok(dates.length < 14);
  assert.ok(new Set(dates).size === dates.length);
  assert.ok(first.workouts.some(workout => workout.cardio.some(activity => activity.activityType === "run" && activity.completed && (activity.intervals || /easy/i.test(activity.name)))));
  assert.ok(first.workouts.some(workout => workout.cardio.some(activity => activity.activityType === "run" && activity.completed && (activity.intervals || /tempo|interval|fast/i.test(`${activity.name} ${activity.intervals}`)))));
  assert.ok(first.workouts.some(workout => workout.cardio.some(activity => activity.activityType === "ruck" && activity.completed && activity.ruckLoad && activity.actualDistanceKm && activity.actualDurationMin)));
  assert.ok(first.workouts.filter(workout => workout.exercises.some(exercise => exercise.sets.some(set => set.completed))).length >= 3);
  assert.ok(first.workouts.some(workout => workout.cardio.some(activity => activity.activityType === "mobility" && activity.completed)));
  for (const workout of first.workouts) {
    for (const activity of workout.cardio) {
      if (activity.activityType !== "run" && activity.activityType !== "ruck") continue;
      if (!activity.actualDistanceKm || !activity.actualDurationMin) continue;
      const pace = activity.actualDurationMin / activity.actualDistanceKm;
      assert.ok(pace > 4 && pace < 20, `${activity.name} pace ${pace}`);
    }
  }
  assert.notEqual(first.workouts[0]?.id, second.workouts[0]?.id);
  assert.equal(first.workouts.every(workout => workout.status === "completed"), true);
});

test("demo strength names are recognized and coverage is uneven", () => {
  const today = "2026-10-11";
  const state = validatedState(buildDemoState(today));
  assert.deepEqual(unmappedExerciseNamesLastDays(state, 14, today), []);
  const coverage = coverageForLastDays(state, 7, today);
  for (const muscle of ["Chest", "Lats", "Upper back", "Front delts", "Side delts", "Rear delts", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Abs"]) {
    assert.ok(coverage.find(item => item.muscle === muscle)!.effectiveSets > 0, muscle);
  }
  const fortnight = coverageForLastDays(state, 14, today);
  assert.ok(fortnight.some(item => item.days >= 2));
  assert.ok(fortnight.some(item => item.days === 1 && item.effectiveSets > 0));
  const loads = fortnight.map(item => item.effectiveSets).filter(value => value > 0);
  assert.ok(Math.max(...loads) > Math.min(...loads));
});

test("demo data is built once per entry, not while editing", () => {
  const persistence = readFileSync(new URL("../app/persistence/use-training-persistence.ts", import.meta.url), "utf8");
  assert.equal((persistence.match(/buildDemoState\(\)/g) ?? []).length, 1);
  const project = persistence.slice(persistence.indexOf("const applyProjectedUpdate"), persistence.indexOf("useEffect"));
  assert.doesNotMatch(project, /buildDemoState/);
  const real = defaultState();
  const demo = buildDemoState("2026-10-11");
  const id = demo.workouts[0]?.id;
  const edited = projectDemoUpdate(real, demo, current => ({ ...current, goals: ["Only in this demo"] }));
  assert.equal(edited.demo?.workouts[0]?.id, id);
  assert.equal(edited.real.workouts.length, 0);
});

test("a sample workout preview is a plan, and example setup does not store it", () => {
  const plan = samplePlan("lb");
  assert.equal(plan.status, "planned");
  assert.equal(plan.completedAt, null);
  assert.equal(plan.exercises.every(exercise => exercise.sets.every(set => !set.completed)), true);
  assert.equal(plan.cardio.every(activity => !activity.completed), true);
  const markup = renderToStaticMarkup(createElement(SampleWorkoutPreview, { unit: "lb", onClose: () => {} }));
  assert.match(markup, /Sample workout/);
  assert.match(markup, /not in your History/);
  assert.match(markup, /Easy bike/);
  assert.match(markup, /Back/);
  assert.doesNotMatch(markup, /Add this plan/);
  const setup = exampleSetupState(defaultState());
  assert.equal(setup.workouts.length, 0);
  assert.equal(setup.goals.length, 2);
  const added = addSamplePlan(setup);
  assert.equal(added.workouts.length, 1);
  assert.equal(added.workouts[0]?.status, "planned");
  assert.equal(added.workouts[0]?.completedAt, null);
});

test("the coaching prompt stays dismissed after one click, including across reload, and demo cannot save that click", () => {
  const setup = exampleSetupState(defaultState());
  assert.equal(coachingPromptVisible(setup), true);
  const dismissed = dismissCoachingPrompt(setup);
  assert.equal(coachingPromptVisible(dismissed), false);
  assert.equal(dismissed.coachProfile, setup.coachProfile);
  const loaded = prepareLoadedState(JSON.parse(JSON.stringify(dismissed)));
  assert.equal(loaded.settings.coachingPromptDismissed, true);
  assert.equal(coachingPromptVisible(loaded), false);
  const real = validatedState(defaultState());
  const demo = validatedState(buildDemoState("2026-10-11"));
  const next = projectDemoUpdate(real, demo, dismissCoachingPrompt);
  assert.equal(next.real.settings.coachingPromptDismissed, undefined);
  assert.equal(next.demo?.settings.coachingPromptDismissed, true);
});
