/* Actual shell/React/IndexedDB. Synthetic data only; no Safari/device claims. */
const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, tab, wait } = require('./helpers/dom-environment.cjs');
const { IDBObjectStore } = require('fake-indexeddb');
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
function inputValue(dom, input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

test('bodyweight unit selection converts the prefilled draft and durable saved mass', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, localDate } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const state = defaultState();
  state.bodyweightEntries = [{ id: 'weight', date: localDate(), weight: 180, unit: 'lb', updatedAt: new Date().toISOString() }];
  await storage.saveTrainingState(state);
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App)); await until(() => document.querySelector('[role="tab"]'), 'opens');
    tab('Progress'); await until(() => document.querySelector('[aria-label="Log bodyweight"]'), 'bodyweight action'); document.querySelector('[aria-label="Log bodyweight"]').click();
    await until(() => document.querySelector('[role="dialog"]'), 'dialog opens');
    const dialog = document.querySelector('[role="dialog"]'), weight = dialog.querySelector('input'), unit = dialog.querySelector('select');
    assert.equal(weight.value, '180');
    unit.value = 'kg'; unit.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => Math.abs(Number(weight.value) - 81.6466) < 0.001, 'kg draft converted');
    unit.value = 'lb'; unit.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => Math.abs(Number(weight.value) - 180) < 0.001, 'roundtrip preserves mass');
    unit.value = 'kg'; unit.dispatchEvent(new Event('change', { bubbles: true })); await wait(20);
    button('Save bodyweight').click();
    await until(async () => (await storage.loadTrainingState()).bodyweightEntries[0].unit === 'kg', 'kg saved');
    const saved = (await storage.loadTrainingState()).bodyweightEntries[0];
    assert.ok(Math.abs(saved.weight - 81.6466) < 0.001); assert.equal(saved.id, 'weight');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('invalid completed-set edit loses credit; aborted Finish keeps editor/draft and successful retry commits before History', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, makeWorkout, makeSet } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const state = defaultState(), workout = makeWorkout('lb', 120, 'Durable Finish QC');
  workout.exercises[0].name = 'Barbell Bench Press';
  workout.exercises[0].sets = [makeSet('lb', { actualReps: '6', actualWeight: 100, completed: true, loadType: 'weighted' })];
  state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(state);
  const root = createRoot(document.getElementById('root')), put = IDBObjectStore.prototype.put;
  let held, holdFinish = false;
  try {
    root.render(React.createElement(App)); await until(() => document.querySelector('.active-workout-card'), 'active workout'); document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-shell'), 'editor opens');
    const expand = document.querySelector('.completed-block'); expand.click();
    await until(() => document.getElementById(`reps-${workout.exercises[0].sets[0].id}`), 'set opens');
    let reps = document.getElementById(`reps-${workout.exercises[0].sets[0].id}`);
    inputValue(dom, reps, 'abc');
    await until(async () => (await storage.loadTrainingState()).workouts[0].exercises[0].sets[0].completed === false, 'invalid actual loses credit');
    assert.match(document.body.textContent, /Incomplete draft/);
    inputValue(dom, reps, '8'); await wait(20);
    document.querySelector('[aria-label="Complete Barbell Bench Press, set 1"]').click();
    await until(async () => (await storage.loadTrainingState()).workouts[0].exercises[0].sets[0].actualReps === '8', 'corrected actual durable');
    IDBObjectStore.prototype.put = function(value, key) {
      if (value?.workouts?.[0]?.status === 'completed') throw new DOMException('QC aborted final save', 'QuotaExceededError');
      return put.call(this, value, key);
    };
    button('Done').click(); await until(() => document.querySelector('[data-slot="alert-dialog-action"]'), 'Finish dialog'); document.querySelector('[data-slot="alert-dialog-action"]').click();
    await until(() => [...document.querySelectorAll('[role="alert"]')].some(el => el.textContent.includes('Could not save')), 'visible failure');
    assert.ok(document.querySelector('.workout-shell')); assert.ok(document.querySelector('[role="alertdialog"]'));
    let durable = await storage.loadTrainingState();
    assert.equal(durable.workouts[0].status, 'active'); assert.equal(durable.workouts[0].exercises[0].sets[0].actualReps, '8');
    // Hold the final put in a live transaction, then release it deliberately.
    IDBObjectStore.prototype.put = function(value, key) {
      if (holdFinish && value?.workouts?.[0]?.status === 'completed') {
        const store = this, tx = this.transaction;
        let released = false;
        held = () => { released = true; };
        const keep = () => {
          const request = store.get(key);
          request.onsuccess = () => { if (released) { put.call(store, value, key); } else keep(); };
        };
        keep();
        // A dummy request provides the result consumed only when tx completes.
        const request = store.get(key); assert.equal(tx.mode, 'readwrite'); return request;
      }
      return put.call(this, value, key);
    };
    holdFinish = true; document.querySelector('[data-slot="alert-dialog-action"]').click();
    await until(() => held, 'final commit delayed');
    assert.ok(document.querySelector('.workout-shell'), 'editor remains until commit');
    assert.ok(document.querySelector('[role="alertdialog"]')); assert.ok(button('Saving…')?.disabled);
    holdFinish = false; held();
    await until(() => !document.querySelector('.workout-shell') && document.querySelector('[role="tab"]'), 'History only after commit');
    durable = await storage.loadTrainingState();
    assert.equal(durable.workouts[0].status, 'completed'); assert.equal(durable.activeWorkoutId, null);
    assert.equal(durable.workouts[0].exercises[0].sets[0].actualReps, '8');
    assert.equal(document.body.style.pointerEvents, '');
    for (const name of ['Today', 'Coach', 'Progress', 'Settings', 'History']) { tab(name); await wait(30); assert.ok(document.querySelector(`[role="tab"][data-state="active"]`)?.textContent === name); }
  } finally { held?.(); IDBObjectStore.prototype.put = put; root.unmount(); await wait(30); dom.window.close(); }
});
