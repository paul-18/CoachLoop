/* Discarding an unfinished workout closes the editor, removes the session,
   and leaves no stale editor state behind (the quick-log focus id included):
   a second quick log after a discard must open cleanly. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs');
const { skipPlannedWorkoutState } = require('../app/domain/workout-transitions.ts');
const { environment, until, wait } = require("./helpers/dom-environment.cjs");

test('skip planned workout commits through commitState and leaves non-planned sessions untouched', () => {
  const controller = fs.readFileSync(require.resolve('../app/shell/use-workout-controller.ts'), 'utf8');
  assert.match(controller, /void commitState\(\(current\) => \{[\s\S]*?skipPlannedWorkoutState\(current, id, reason, skippedAt\)/);
  assert.match(controller, /\}\)\.catch\(saveFailure\);/);

  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState();
  const planned = makeWorkout('lb', 90, 'Planned');
  planned.status = 'planned';
  const completed = makeWorkout('lb', 90, 'Completed');
  completed.status = 'completed';
  state.workouts = [planned, completed];

  const next = skipPlannedWorkoutState(state, planned.id, 'Unavailable', '2026-11-25T12:00:00.000Z');
  assert.notStrictEqual(next, state);
  assert.equal(next.workouts[0].status, 'skipped');
  assert.equal(next.workouts[0].skipReason, 'Unavailable');
  assert.strictEqual(next.workouts[1], completed, 'a completed workout is not modified');
  assert.strictEqual(skipPlannedWorkoutState(next, completed.id, 'No reason'), next, 'non-planned id is a clean no-op');
});


test('discarding a blank workout closes the editor and removes the session', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  await storage.saveTrainingState(defaultState());
  const root = createRoot(document.getElementById('root'));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  try {
    root.render(React.createElement(App));
    await until(() => button('Start blank'), 'welcome opens');
    button('Start blank').click();
    await until(() => button('Blank workout'), 'today offers a blank workout');
    button('Blank workout').click();
    await until(() => document.querySelector('.workout-header'), 'workout editor opens');
    const before = await storage.loadTrainingState();
    assert.equal(before.workouts.length, 1);
    assert.equal(before.workouts[0].status, 'active');
    button('Discard').click();
    await until(() => document.querySelector('[role="alertdialog"]'), 'discard confirm opens');
    const dialog = document.querySelector('[role="alertdialog"]');
    const confirm = [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === 'Discard');
    assert.ok(confirm, 'confirm button present');
    confirm.click();
    await until(() => !document.querySelector('.workout-header'), 'editor closes after discard');
    await until(() => button('Blank workout'), 'back on Today after discard');
    assert.equal(document.querySelector('.active-workout-card'), null, 'no workout in progress after discard');
    const after = await storage.loadTrainingState();
    assert.equal(after.workouts.length, 0);
    assert.equal(after.deletedWorkoutIds?.includes(before.workouts[0].id), true);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('discarding a quick-log workout leaves the next quick log clean', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  await storage.saveTrainingState(defaultState());
  const root = createRoot(document.getElementById('root'));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  const quickLogButton = label => {
    const grid = document.querySelector('.quick-grid');
    if (!grid) return null;
    return [...grid.querySelectorAll('button')].find(b => b.textContent.includes(label));
  };
  try {
    root.render(React.createElement(App));
    await until(() => button('Start blank'), 'welcome opens');
    button('Start blank').click();
    await until(() => quickLogButton('Run'), 'quick log offers Run');
    quickLogButton('Run').click();
    await until(() => document.querySelector('.workout-header'), 'quick-log editor opens');
    button('Discard').click();
    await until(() => document.querySelector('[role="alertdialog"]'), 'discard confirm opens');
    const dialog = document.querySelector('[role="alertdialog"]');
    [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === 'Discard').click();
    await until(() => !document.querySelector('.workout-header'), 'editor closes after discard');
    // A second quick log must open with its own activity, not a stale focus id.
    await until(() => quickLogButton('Run'), 'quick log offers Run again');
    quickLogButton('Run').click();
    await until(() => document.querySelector('.workout-header'), 'second quick-log editor opens');
    const state = await storage.loadTrainingState();
    assert.equal(state.workouts.filter(w => w.status === 'active').length, 1);
    assert.equal(state.workouts.find(w => w.status === 'active')?.cardio[0]?.activityType, 'run');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
