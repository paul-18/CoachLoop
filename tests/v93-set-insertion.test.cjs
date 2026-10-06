const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, wait } = require('./helpers/dom-environment.cjs');

test('inserting through a set menu persists warm-ups between existing rows and preserves completed evidence after reopening', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, makeWorkout, makeSet } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const state = defaultState(), workout = makeWorkout('lb', 0, 'Set insertion QC'), exercise = workout.exercises[0];
  exercise.name = 'Barbell Bench Press';
  const warmup = makeSet('lb', { plannedReps: '8', plannedWeight: 65, loadType: 'weighted', warmup: true, completed: true, actualReps: '8', actualWeight: 65 });
  const working = makeSet('lb', { plannedReps: '5', plannedWeight: 135, loadType: 'weighted' });
  exercise.sets = [warmup, working]; state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(require('../app/persistence/migrations.ts').prepareLoadedState(state));
  let root = createRoot(document.getElementById('root'));
  const savedSets = async () => (await storage.loadTrainingState()).workouts[0].exercises[0].sets;
  async function enter() {
    await until(() => document.querySelector('.active-workout-card'), 'active workout ready'); document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-shell'), 'editor opened');
  }
  async function choose(label, action) {
    const trigger = document.querySelector(`[aria-label="${label}"]`); assert.ok(trigger, label);
    trigger.focus(); trigger.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, ctrlKey: false }));
    await until(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === action), 'insert action available');
    [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === action).click();
    await until(() => !document.querySelector('[role="menu"]'), 'menu closes');
  }
  try {
    root.render(React.createElement(App)); await enter();
    const previous = await savedSets();
    await choose('Options for Barbell Bench Press, warm-up set 1', 'Insert set after');
    await until(async () => (await savedSets()).length === 3, 'insert durably saved');
    let sets = await savedSets(), inserted = sets[1];
    assert.equal(sets[0].id, warmup.id); assert.equal(sets[2].id, working.id);
    assert.deepEqual(sets[0], previous[0]); assert.deepEqual(sets[2], previous[1]);
    assert.equal(inserted.warmup, true); assert.equal(inserted.completed, false); assert.equal(inserted.actualReps, '');
    const rows = [...document.querySelectorAll('.set-row[role="group"]')];
    assert.match(rows[1].getAttribute('aria-label'), /warm-up set 2/); assert.match(rows[2].getAttribute('aria-label'), /set 3/);
    await choose('Options for Barbell Bench Press, set 3', 'Insert set before');
    await until(async () => (await savedSets()).length === 4, 'before insert saved');
    sets = await savedSets(); assert.equal(sets[1].id, inserted.id); assert.equal(sets[2].warmup, false); assert.equal(sets[3].id, working.id);
    assert.equal(sets[2].completed, false);
    const orderedIds = sets.map(set => set.id);
    root.unmount(); await wait(40); root = createRoot(document.getElementById('root')); root.render(React.createElement(App)); await enter();
    assert.deepEqual((await savedSets()).map(set => set.id), orderedIds);
    assert.equal(document.querySelectorAll('.set-row').length, 4);
    assert.equal((await storage.loadTrainingState()).workouts[0].date, workout.date);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
