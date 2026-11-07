const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { environment, until, wait } = require("./helpers/dom-environment.cjs");

const root = join(__dirname, "..");

test("v121: Finish workout dialog places Session effort prominently at top with quick-pick chips and preserves effort on Keep training", async () => {
  const dom = environment();
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const App = require("../app/workout-app.tsx").default;
  const storage = require("../app/persistence/training-storage.ts");
  const { defaultState, makeWorkout, makeSet, makeCardio } = require("../app/domain/training-types.ts");
  const { prepareLoadedState } = require("../app/persistence/migrations.ts");

  const state = defaultState();
  state.settings.welcomeChoice = "blank";
  const workout = makeWorkout("lb", 90, "v121 Effort Prominence");
  workout.exercises[0].name = "Barbell Squat";
  workout.exercises[0].sets = [
    makeSet("lb", { plannedWeight: 225, plannedReps: "5", actualWeight: 235, actualReps: "5", completed: true, loadType: "weighted" }),
  ];
  const bike = makeCardio("bike", "Cooldown Bike");
  bike.plannedDurationMin = 10;
  bike.actualDurationMin = 12;
  bike.completed = false;
  workout.cardio = [bike];
  workout.blockOrder = [
    { type: "exercise", id: workout.exercises[0].id },
    { type: "activity", id: bike.id },
  ];
  state.workouts = [workout];
  state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(prepareLoadedState(state));

  const reactRoot = createRoot(document.getElementById("root"));
  try {
    reactRoot.render(React.createElement(App));
    await until(() => document.querySelector(".active-workout-card"), "active workout card renders");
    document.querySelector(".active-workout-card").click();
    await until(() => document.querySelector(".workout-header"), "workout editor opens");

    const finishBtn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Finish workout");
    finishBtn.click();
    await until(() => document.querySelector('[role="alertdialog"]')?.textContent.includes("Results are not marked complete"), "unconfirmed actuals prompt opens");

    const markBtn = [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === "Mark complete and finish");
    markBtn.click();
    await until(() => document.querySelector(".finish-effort-card"), "prominent session effort card renders in finish dialog");

    const finishReview = document.querySelector(".finish-review");
    assert.ok(finishReview, ".finish-review container exists");
    const childrenClasses = [...finishReview.children].map((el) => el.className);
    assert.ok(childrenClasses[0].includes("finish-fields"), "finish-fields (Session effort + Notes) is the very first item in .finish-review");

    // Quick-select chip sets sessionRpe
    const chip8 = [...document.querySelectorAll(".finish-effort-chip")].find((b) => b.textContent.includes("8") && b.textContent.includes("Hard"));
    assert.ok(chip8, "8 Hard quick-select chip exists");
    chip8.click();
    await until(() => document.querySelector('[aria-label="Session effort out of 10"]')?.value === "8", "tapping chip 8 populates sessionRpe input");
    assert.equal(chip8.getAttribute("aria-pressed"), "true", "selected chip has aria-pressed=true");

    // Cancel via Keep training: staged cardio completion is NOT committed, but sessionRpe IS preserved!
    const keepTraining = [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === "Keep training");
    keepTraining.click();
    await until(() => !document.querySelector('[role="alertdialog"]'), "finish dialog closes");
    await until(async () => (await storage.loadTrainingState()).workouts[0].sessionRpe === "8", "sessionRpe survives Keep training even when finishCandidate was used");
    const saved = (await storage.loadTrainingState()).workouts[0];
    assert.equal(saved.cardio[0].completed, false, "staged cardio completion is not committed on cancel");
  } finally {
    reactRoot.unmount();
    await wait(30);
    dom.window.close();
  }
});

test("v121: working set numbering after warm-ups is consistent in planDifferences, trainingCsvRows, and HistoryView", () => {
  const { defaultState, makeWorkout, makeSet } = require("../app/domain/training-types.ts");
  const { planDifferences } = require("../app/domain/plan-review.ts");
  const { trainingCsvRows } = require("../app/interchange/training-csv.ts");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { HistoryView } = require("../app/views/history-view.tsx");

  const state = defaultState();
  const workout = makeWorkout("lb", 90, "Warmup Numbering Test");
  workout.status = "completed";
  workout.completedAt = "2026-11-06T12:00:00Z";
  workout.exercises[0].name = "Bench Press";
  workout.exercises[0].sets = [
    makeSet("lb", { warmup: true, plannedWeight: 135, plannedReps: "5", actualWeight: 135, actualReps: "5", completed: true, loadType: "weighted" }),
    makeSet("lb", { warmup: false, plannedWeight: 185, plannedReps: "5", actualWeight: 195, actualReps: "5", completed: true, loadType: "weighted" }),
    makeSet("lb", { warmup: false, plannedWeight: 185, plannedReps: "5", actualWeight: 185, actualReps: "5", completed: true, loadType: "weighted" }),
  ];
  state.workouts = [workout];

  // 1. planDifferences numbers working set 1 as "Set 1", not "Set 2"
  assert.deepEqual(planDifferences(workout), ["Bench Press · Set 1: 185 lb × 5 → 195 lb × 5"]);

  // 2. trainingCsvRows numbers warmup as "W1" and working sets as "1", "2"
  const rows = trainingCsvRows(state);
  assert.deepEqual(rows.slice(1).map((r) => r[5]), ["W1", "1", "2"]);

  // 3. HistoryView renders W1, 1, 2
  sessionStorage.setItem("coach-loop-history-view", JSON.stringify({ search: "", filter: "all", expanded: workout.id, page: 0 }));
  const markup = renderToStaticMarkup(React.createElement(HistoryView, {
    state,
    onEdit: () => {},
    onRepeat: () => {},
    onReplan: () => {},
    onDelete: () => {},
  }));
  const indices = [...markup.matchAll(/<span class="history-set-index">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(indices, ["W1", "1", "2"]);
});

test("v121: substituteExercise preserves plannedRpe and plannedRir; repeatWorkoutDraft and replanWorkoutDraft preserve and clean fields", () => {
  const { makeWorkout, makeSet, makeCardio } = require("../app/domain/training-types.ts");
  const { substituteExercise } = require("../app/domain/training-workflow.ts");
  const { repeatWorkoutDraft, replanWorkoutDraft } = require("../app/domain/workout-copy.ts");

  const workout = makeWorkout("lb", 90, "Sub & Copy Test");
  workout.importFingerprint = "fp-123";
  workout.importWarnings = ["warn"];
  workout.deletedExerciseIds = ["old-ex"];
  workout.deletedActivityIds = ["old-act"];
  workout.exercises[0].name = "Back Squat";
  workout.exercises[0].sets = [
    makeSet("lb", { plannedWeight: 225, plannedReps: "5", plannedRpe: "8", plannedRir: "2", completed: false }),
  ];
  const subbed = substituteExercise(workout, workout.exercises[0].id, "Front Squat", "lb");
  const replacement = subbed.exercises.find((e) => e.name === "Front Squat");
  assert.ok(replacement);
  assert.equal(replacement.sets[0].plannedRpe, "8");
  assert.equal(replacement.sets[0].plannedRir, "2");

  // repeatWorkoutDraft preserves plannedDurationMin when completed cardio has null actualDurationMin
  const run = makeCardio("run", "Tempo Run");
  run.plannedDurationMin = 30;
  run.plannedDistanceKm = 5;
  run.completed = true;
  run.actualDurationMin = null;
  run.actualDistanceKm = null;
  run.averageHr = 155;
  run.elevationM = 120;
  run.pace = "5:00/km";
  workout.cardio = [run];

  const repeated = repeatWorkoutDraft(workout);
  assert.equal(repeated.cardio[0].plannedDurationMin, 30);
  assert.equal(repeated.cardio[0].plannedDistanceKm, 5);

  const replanned = replanWorkoutDraft(workout);
  assert.equal(replanned.importFingerprint, undefined);
  assert.equal(replanned.importWarnings, undefined);
  assert.equal(replanned.deletedExerciseIds, undefined);
  assert.equal(replanned.deletedActivityIds, undefined);
  assert.equal(replanned.cardio[0].averageHr, null);
  assert.equal(replanned.cardio[0].elevationM, null);
  assert.equal(replanned.cardio[0].pace, "");
});

test("v121: dialog close button keeps sleek size-4 X icon with subtle invisible touch padding", () => {
  const dialogSrc = readFileSync(join(root, "components/ui/dialog.tsx"), "utf8");
  assert.match(dialogSrc, /data-slot="dialog-close"/);
  assert.match(dialogSrc, /-m-2 rounded-xs p-2/);
  assert.match(dialogSrc, /size-4/);
});
