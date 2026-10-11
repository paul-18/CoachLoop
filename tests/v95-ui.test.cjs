const test = require("node:test"), assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { environment, until, wait } = require("./helpers/dom-environment.cjs");

test("changing the workout date returns focus to Workout options, not the page body", async () => {
  const dom = environment(), React = require("react"), { createRoot } = require("react-dom/client");
  const App = require("../app/workout-app.tsx").default;
  const { defaultState, makeWorkout } = require("../app/domain/training-types.ts");
  const storage = require("../app/persistence/training-storage.ts");
  const state = defaultState(), workout = makeWorkout("lb", 0, "Date focus QC");
  state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(state);
  const root = createRoot(document.getElementById("root"));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector(".active-workout-card"), "active");
    document.querySelector(".active-workout-card").click();
    await until(() => document.querySelector(".workout-shell"), "editor");
    const options = document.querySelector('[aria-label="Workout options"]');
    assert.ok(options);
    options.focus();
    options.dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, ctrlKey: false }));
    await until(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === "Change workout date"), "date action");
    [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === "Change workout date").click();
    await until(() => document.querySelector('[role="dialog"]'), "date dialog");
    [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent.trim() === "Cancel").click();
    await until(() => !document.querySelector('[role="dialog"]'), "date dialog closed");
    await until(() => document.activeElement === options, "focus returns to Workout options");
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test("sidebar list opts out of the shared 36px tab height without changing that component", () => {
  const tabs = readFileSync(path.join(__dirname, "../components/ui/tabs.tsx"), "utf8");
  const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");
  assert.match(tabs, /group-data-\[orientation=horizontal\]\/tabs:h-9/);
  assert.match(css, /\.rail-nav \{ height: auto;/);
  assert.doesNotMatch(css, /\.mobile-nav \{[^}]*height: auto/);
});
