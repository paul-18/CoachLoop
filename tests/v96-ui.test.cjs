const test = require("node:test"), assert = require("node:assert/strict");
const { environment, until, wait } = require("./helpers/dom-environment.cjs");

async function openEditor() {
  const dom = environment(), React = require("react"), { createRoot } = require("react-dom/client");
  const App = require("../app/workout-app.tsx").default;
  const { defaultState, makeWorkout } = require("../app/domain/training-types.ts");
  const storage = require("../app/persistence/training-storage.ts");
  const state = defaultState(), workout = makeWorkout("lb", 0, "Focus QC");
  workout.exercises[0].name = "Barbell Bench Press";
  state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(state);
  const root = createRoot(document.getElementById("root"));
  root.render(React.createElement(App));
  await until(() => document.querySelector(".active-workout-card"), "active");
  document.querySelector(".active-workout-card").click();
  await until(() => document.querySelector(".workout-shell"), "editor");
  return { dom, root };
}

async function choose(triggerLabel, action) {
  const trigger = document.querySelector(`[aria-label="${triggerLabel}"]`);
  assert.ok(trigger, triggerLabel);
  trigger.focus();
  trigger.dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, ctrlKey: false }));
  await until(() => [...document.querySelectorAll('[role="menuitem"]')].some((item) => item.textContent.trim() === action), action);
  [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent.trim() === action).click();
  return trigger;
}

test("finish opened from the menu returns focus to Workout options", async () => {
  const { dom, root } = await openEditor();
  try {
    const options = await choose("Workout options", "Finish workout");
    await until(() => document.querySelector('[role="alertdialog"], [role="dialog"]'), "finish dialog");
    [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Keep training").click();
    await until(() => !document.querySelector('[role="alertdialog"]'), "finish closed");
    await until(() => document.activeElement === options, "focus returns to Workout options");
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test("closing substitute returns focus to that exercise's options button", async () => {
  const { dom, root } = await openEditor();
  try {
    const options = await choose("Options for Barbell Bench Press", "Substitute remaining sets");
    await until(() => document.querySelector('[role="dialog"]'), "substitute dialog");
    document.querySelector('[data-slot="dialog-close"]').click();
    await until(() => !document.querySelector('[role="dialog"]'), "substitute closed");
    await until(() => document.activeElement === options, "focus returns to the exercise options");
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
