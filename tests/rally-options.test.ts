import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BodyCoverageMap } from "../app/views/body-coverage-map";
import { QuickLogButtons } from "../app/views/quick-log-buttons";
import { defaultState, localDate, makeCardio, makeWorkout } from "../app/domain/training-types";
import { parseFitlog } from "../app/interchange/fitlog";
import { completedActivityValues } from "../app/domain/completion";
import { activityLoggingStyle } from "../app/domain/activity-logging";
import { activityBreakdownForLastDays, coverageForLastDays } from "../app/domain/training-coverage";
import { activityRows, activityTotals } from "../app/domain/training-workflow";
import { prepareLoadedState } from "../app/persistence/migrations";
import { mergeRestoredState } from "../app/persistence/cloud-sync";
import { exportCompletedHistory } from "../app/interchange/history-export";

test("water polo imports as a sport routine and completed minutes stay separate from circuits and swimming", () => {
  const workout = parseFitlog(`[FITLOG:1]\nWORKOUT|Sports circuit|${localDate()}\nCARDIO|Water polo practice\nTYPE|water_polo\nDURATION|45\nNOTES|Drills and match play.\nCARDIO|Conditioning\nTYPE|circuit\nDURATION|10\n[/FITLOG]`, "lb", {});
  assert.equal(activityLoggingStyle(workout.cardio[0]), "routine");
  assert.equal(workout.cardio[0].actualDurationMin, null);
  workout.cardio[0].actualDurationMin = 30;
  workout.cardio.forEach(activity => Object.assign(activity, completedActivityValues(activity), { completed: true }));
  workout.status = "completed";
  const state = { ...defaultState(), workouts: [workout] };
  const totals = activityBreakdownForLastDays(state, "lb");
  assert.equal(totals.waterPolo.minutes, 30);
  assert.equal(totals.waterPolo.sessions, 1);
  assert.equal(totals.circuits.minutes, 10);
  assert.equal(totals.circuits.sessions, 1);
  assert.equal(activityRows(state, "swim").length, 0);
  assert.equal(activityTotals(activityRows(state, "water_polo")).minutes, 30);
  assert.ok(coverageForLastDays(state).every(entry => entry.effectiveSets === 0));
  assert.match(exportCompletedHistory(state), /Water polo practice: 30 min/);
  const restored = prepareLoadedState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.workouts[0].cardio[0].activityType, "water_polo");
  assert.equal(restored.workouts[0].cardio[0].actualDurationMin, 30);
  assert.equal(makeCardio("water_polo").name, "Water polo");
});

test("diagram and ordered shortcut choices survive backup restore, while old backups get defaults", () => {
  const state = defaultState();
  state.settings.bodyDiagram = "female";
  state.settings.quickLogActivities = ["water_polo", "circuit", "run"];
  state.settingsUpdatedAt = new Date().toISOString();
  const saved = prepareLoadedState(JSON.parse(JSON.stringify(state)));
  const restored = mergeRestoredState(defaultState(), saved);
  assert.equal(restored.settings.bodyDiagram, "female");
  assert.deepEqual(restored.settings.quickLogActivities, ["water_polo", "circuit", "run"]);
  delete saved.settings.bodyDiagram; delete saved.settings.quickLogActivities;
  const legacy = prepareLoadedState(saved);
  assert.equal(legacy.settings.bodyDiagram, "male");
  assert.ok(legacy.settings.quickLogActivities?.includes("water_polo"));
  assert.throws(() => prepareLoadedState({ ...state, settings: { ...state.settings, quickLogActivities: ["unsupported"] } }));
  assert.throws(() => prepareLoadedState({ ...state, settings: { ...state.settings, quickLogActivities: ["run", "run"] } }));
});

test("selected quick-log buttons render in saved order and hiding a shortcut keeps history", () => {
  const state = defaultState();
  state.workouts = [makeWorkout("lb", 120)];
  state.settings.quickLogActivities = ["water_polo", "run"];
  const before = JSON.stringify(state.workouts);
  const html = renderToStaticMarkup(createElement(QuickLogButtons, { settings: state.settings, disabled: false, onChoose() {} }));
  assert.ok(html.indexOf("Water polo") < html.indexOf("Run"));
  assert.doesNotMatch(html, /<span>Circuit<\/span>/);
  state.settings.quickLogActivities = [];
  assert.match(renderToStaticMarkup(createElement(QuickLogButtons, { settings: state.settings, disabled: false, onChoose() {} })), /Choose your quick-log activities/);
  assert.equal(JSON.stringify(state.workouts), before);
});

test("both body visuals keep every interactive muscle region, with corrected heads only on the female visual", () => {
  const coverage = coverageForLastDays(defaultState());
  const draw = (bodyDiagram: "male" | "female") => renderToStaticMarkup(createElement(BodyCoverageMap, { coverage, selected: "Chest", onSelect() {}, bodyDiagram }));
  const male = draw("male"), female = draw("female");
  assert.equal((male.match(/role="button"/g) ?? []).length, (female.match(/role="button"/g) ?? []).length);
  assert.match(male, /Show Chest coverage/); assert.match(female, /Show Chest coverage/);
  assert.equal((female.match(/class="anatomy-head"/g) ?? []).length, 2);
  assert.doesNotMatch(male, /class="anatomy-head"/);
  assert.equal((female.match(/class="anatomy-face"/g) ?? []).length, 1);
});
