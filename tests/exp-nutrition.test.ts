import assert from "node:assert/strict";
import test from "node:test";
import { dayTotals, emptyDayLog, makeMeal, remainingKcal, validateMeal } from "../app/domain/nutrition-types";
import { defaultState } from "../app/domain/training-types";
import { prepareLoadedState } from "../app/persistence/migrations";
import { mergeRestoredState } from "../app/persistence/cloud-sync";
import { portableBackup } from "../app/persistence/portable-backup";

test("emptyDayLog creates an empty log for the date with the given target", () => {
  assert.deepEqual(emptyDayLog("2026-10-10", 2000), { date: "2026-10-10", targetKcal: 2000, meals: [] });
});

test("dayTotals and remainingKcal do the math", () => {
  const log = emptyDayLog("2026-10-10", 2000);
  log.meals.push(
    { id: "meal-1", name: "Oats", kcal: 500, proteinG: 30 },
    { id: "meal-2", name: "Apple", kcal: 95 },
  );
  assert.deepEqual(dayTotals(log), { kcal: 595, proteinG: 30 });
  assert.equal(remainingKcal(log), 1405);
});

test("remainingKcal goes negative when over target", () => {
  const log = emptyDayLog("2026-10-10", 100);
  log.meals.push({ id: "meal-1", name: "Burger", kcal: 800 });
  assert.equal(remainingKcal(log), -700);
});

test("validateMeal trims the name and returns validated fields", () => {
  assert.deepEqual(validateMeal("  Chicken bowl  ", 650, 40), { name: "Chicken bowl", kcal: 650, proteinG: 40 });
});

test("validateMeal accepts zero kcal and omits protein when not given", () => {
  assert.deepEqual(validateMeal("Water", 0), { name: "Water", kcal: 0 });
  assert.deepEqual(validateMeal("Oats", "350", ""), { name: "Oats", kcal: 350 });
});

test("validateMeal rejects empty names", () => {
  assert.throws(() => validateMeal("   ", 100), /name/i);
});

test("validateMeal rejects negative, NaN, non-numeric and huge kcal", () => {
  for (const kcal of [-1, Number.NaN, "abc", "", 20001, Infinity]) {
    assert.throws(() => validateMeal("Oats", kcal), /calories/i, `kcal=${String(kcal)}`);
  }
});

test("validateMeal accepts the 20,000 kcal upper bound", () => {
  assert.equal(validateMeal("Feast", 20000).kcal, 20000);
});

test("validateMeal rejects negative protein but accepts zero", () => {
  assert.throws(() => validateMeal("Oats", 100, -5), /protein/i);
  assert.deepEqual(validateMeal("Oats", 100, 0), { name: "Oats", kcal: 100, proteinG: 0 });
});

test("makeMeal assigns a meal id and validates", () => {
  const meal = makeMeal(" Oats ", 350, 12);
  assert.match(meal.id, /^meal-/);
  assert.equal(meal.name, "Oats");
  assert.throws(() => makeMeal("", 100), /name/i);
});

test("defaultState starts with an empty nutrition log", () => {
  assert.deepEqual(defaultState().nutritionLogs, []);
});

test("prepareLoadedState defaults missing nutritionLogs to []", () => {
  const state = prepareLoadedState({ version: 1, goals: [], workouts: [] });
  assert.deepEqual(state.nutritionLogs, []);
});

test("prepareLoadedState defaults non-array nutritionLogs to []", () => {
  const state = prepareLoadedState({ version: 1, goals: [], workouts: [], nutritionLogs: "nope" });
  assert.deepEqual(state.nutritionLogs, []);
});

test("prepareLoadedState keeps valid nutrition logs", () => {
  const state = prepareLoadedState({
    version: 1, goals: [], workouts: [],
    nutritionLogs: [{ date: "2026-10-10", targetKcal: 2000, meals: [{ id: "meal-1", name: "Oats", kcal: 350, proteinG: 12 }] }],
  });
  assert.equal(state.nutritionLogs.length, 1);
  assert.equal(state.nutritionLogs[0].meals[0].name, "Oats");
});

test("prepareLoadedState throws a descriptive error on invalid nutrition logs", () => {
  const bad = [
    [{ date: "not-a-date", targetKcal: 2000, meals: [] }],
    [{ date: "2026-10-10", targetKcal: -5, meals: [] }],
    [{ date: "2026-10-10", targetKcal: 2000, meals: "nope" }],
    [{ date: "2026-10-10", targetKcal: 2000, meals: [{ id: "meal-1", name: "Oats", kcal: -10 }] }],
    [{ date: "2026-10-10", targetKcal: 2000, meals: [{ id: "meal-1", name: "Oats", kcal: 100, proteinG: -2 }] }],
    [{ date: "2026-13-40", targetKcal: 2000, meals: [] }],
  ];
  for (const nutritionLogs of bad) {
    assert.throws(
      () => prepareLoadedState({ version: 1, goals: [], workouts: [], nutritionLogs }),
      /Invalid nutrition record/,
      JSON.stringify(nutritionLogs),
    );
  }
});

test("portable backups include nutrition logs but strip the AI key", () => {
  const state = defaultState();
  state.nutritionLogs = [{ date: "2026-10-10", targetKcal: 2000, meals: [{ id: "meal-1", name: "Oats", kcal: 350 }] }];
  state.settings.aiApiKey = "secret";
  const backup = portableBackup(state, state);
  assert.equal(backup.nutritionLogs.length, 1);
  assert.equal(backup.nutritionLogs[0].meals[0].name, "Oats");
  assert.equal(backup.settings.aiApiKey, undefined);
});

test("restore merge unions nutrition meals by id across devices", () => {
  const current = defaultState();
  current.nutritionLogs = [{ date: "2026-10-10", targetKcal: 2000, meals: [{ id: "meal-1", name: "Oats", kcal: 350 }] }];
  const backup = defaultState();
  backup.nutritionLogs = [{ date: "2026-10-10", targetKcal: 2200, meals: [{ id: "meal-2", name: "Apple", kcal: 95 }] }];
  const merged = mergeRestoredState(current, backup);
  assert.equal(merged.nutritionLogs.length, 1);
  assert.deepEqual(merged.nutritionLogs[0].meals.map(meal => meal.id).sort(), ["meal-1", "meal-2"]);
});
