/* Synthetic DOM + IndexedDB journeys; no physical iPhone claims. */
const test = require('node:test'), assert = require('node:assert/strict');
const { IDBObjectStore } = require('fake-indexeddb');
const { environment, until, tab, wait } = require('./helpers/dom-environment.cjs');
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
function inputValue(dom, input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

test('Verify saved backup success, rejection, cancellation and oversized files never write or restore', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { syntheticHistory } = require('../scripts/qc-history-data.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const { serializeBackup, MAX_BACKUP_BYTES } = require('../app/persistence/backup-tools.ts');
  const original = syntheticHistory(2), backup = syntheticHistory(3);
  await storage.saveTrainingState(original);
  const root = createRoot(document.getElementById('root')), put = IDBObjectStore.prototype.put;
  let writes = 0;
  try {
    root.render(React.createElement(App)); await until(() => document.querySelector('[role="tab"]'), 'opens');
    tab('Settings'); await until(() => button('Verify saved backup'), 'verify action'); await wait(60);
    const before = await storage.loadTrainingState();
    IDBObjectStore.prototype.put = function(...args) { writes++; return put.apply(this, args); };
    const input = document.querySelector('[aria-label="Choose saved backup to verify"]');
    const choose = file => { Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); };
    choose(null); await wait(20); assert.equal(document.querySelector('[role="dialog"]'), null);
    choose({ name: 'saved-backup.json', size: 100, text: async () => serializeBackup(backup) });
    await until(() => document.body.textContent.includes('Readable, compatible backup'), 'compatible file report');
    assert.ok(document.querySelector('[role="dialog"]').textContent.includes('2026-10-02 to 2026-10-04'));
    assert.ok(document.querySelector('[role="dialog"]').textContent.includes('3'));
    assert.ok(!document.querySelector('[role="dialog"]').textContent.includes('Merge backup'));
    button('Done').click(); await until(() => !document.querySelector('[role="dialog"]'), 'closed');
    await until(() => document.activeElement === button('Verify saved backup'), 'focus returns');
    choose({ name: 'corrupt.json', size: 12, text: async () => '{"version":1' });
    await until(() => document.body.textContent.includes('incomplete or corrupt'), 'corrupt file explained');
    button('Done').click(); await wait(30);
    choose({ name: 'future.json', size: 14, text: async () => '{"version":99}' });
    await until(() => document.body.textContent.includes('different or newer'), 'newer file explained');
    button('Done').click(); await wait(30);
    let readLarge = false;
    choose({ name: 'too-big.json', size: MAX_BACKUP_BYTES + 1, text: async () => { readLarge = true; return ''; } });
    await until(() => document.body.textContent.includes('50 MB limit'), 'size boundary'); assert.equal(readLarge, false);
    button('Done').click(); await wait(30);
    let release;
    choose({ name: 'cancelled.json', size: 100, text: () => new Promise(resolve => { release = resolve; }) });
    await until(() => document.body.textContent.includes('Reading and checking'), 'reading');
    button('Done').click(); await wait(30); release(serializeBackup(backup)); await wait(30);
    assert.equal(document.querySelector('[role="dialog"]'), null, 'late read cannot reopen after cancellation');
    assert.equal(writes, 0, 'inspection never writes any IndexedDB store');
    assert.deepEqual(await storage.loadTrainingState(), before);
    assert.equal(document.body.style.pointerEvents, '');
    for (const name of ['History', 'Coach', 'Progress', 'Today']) { tab(name); await wait(30); assert.equal(document.querySelector('[role="tab"][data-state="active"]')?.textContent, name); }
  } finally { IDBObjectStore.prototype.put = put; root.unmount(); await wait(30); dom.window.close(); }
});

test('large History stays bounded while search, pagination and remembered expanded session reach older records', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const { HistoryView } = require('../app/views/history-view.tsx');
  const { syntheticHistory } = require('../scripts/qc-history-data.ts');
  const state = syntheticHistory(120), props = { state, onEdit() {}, onRepeat() {}, onReplan() {}, onDelete() {} };
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(HistoryView, props)); await until(() => document.querySelector('.history-card'), 'history');
    assert.equal(document.querySelectorAll('.history-card').length, 50);
    button('Next 50').click(); await until(() => document.body.textContent.includes('Showing 51–100'), 'second page');
    button('Next 50').click(); await until(() => document.body.textContent.includes('Showing 101–120'), 'third page');
    assert.equal(document.querySelectorAll('.history-card').length, 20);
    const older = document.querySelector('.history-card > button'); older.click(); await wait(20);
    assert.equal(older.getAttribute('aria-expanded'), 'true');
    const memory = JSON.parse(sessionStorage.getItem('coach-loop-history-view')); assert.equal(memory.page, 2);
    inputValue(dom, document.querySelector('[aria-label="Search workouts or exercises"]'), 'SYNTHETIC QC 1 —');
    await until(() => document.querySelectorAll('.history-card').length === 1, 'oldest is searchable from all history');
    assert.ok(document.querySelector('.history-card').textContent.includes('SYNTHETIC QC 1 —'));
    inputValue(dom, document.querySelector('[aria-label="Search workouts or exercises"]'), ''); await wait(20);
    assert.equal(document.querySelectorAll('.history-card').length, 50); assert.ok(document.body.textContent.includes('Showing 1–50'));
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('repeated set controls name exercise, set and units; evidence error is associated and note focus returns', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, makeWorkout, makeExercise, makeSet } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const state = defaultState(), workout = makeWorkout('lb', 0, 'Accessible QC');
  workout.exercises = ['Barbell Bench Press', 'Cable Seated Row'].map(name => { const e = makeExercise('lb', 0, name); e.sets = [makeSet('lb')]; return e; });
  workout.blockOrder = workout.exercises.map(e => ({ type: 'exercise', id: e.id }));
  state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(state);
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App)); await until(() => document.querySelector('.active-workout-card'), 'active'); document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-shell'), 'editor');
    assert.ok(document.querySelector('[aria-label="Barbell Bench Press, set 1, actual weight in pounds total"]'));
    assert.ok(document.querySelector('[aria-label="Cable Seated Row, set 1, actual reps"]'));
    const reps = document.querySelector('[aria-label="Barbell Bench Press, set 1, actual reps"]');
    inputValue(dom, reps, 'abc'); await until(() => reps.getAttribute('aria-invalid') === 'true', 'invalid described');
    assert.ok(document.getElementById(reps.getAttribute('aria-describedby')).textContent.includes('positive whole'));
    inputValue(dom, reps, '8'); await until(() => reps.getAttribute('aria-invalid') === 'false', 'corrected');
    const options = document.querySelector('[aria-label="Options for Barbell Bench Press, set 1"]');
    options.focus(); options.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, ctrlKey: false }));
    await until(() => [...document.querySelectorAll('[role="menuitem"]')].some(e => e.textContent === 'Add set note'), 'set menu');
    [...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent === 'Add set note').click();
    await until(() => document.querySelector('[aria-label="Note for Barbell Bench Press, set 1"]'), 'note dialog');
    document.querySelector('[role="dialog"] button:not([data-slot="dialog-close"])').click();
    await until(() => !document.querySelector('[role="dialog"]'), 'note closed');
    await until(() => document.activeElement === options, 'note returns focus to original set');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
