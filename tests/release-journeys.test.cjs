/* Real React DOM + isolated synthetic IndexedDB. This is not an iOS browser test. */
const test = require('node:test'), assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await wait(20); }
  assert.ok(await check(), label);
}
function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/CoachLoop/', pretendToBeVisual: true });
  const bound = new Set(['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']);
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLDetailsElement', 'SVGElement', 'Node', 'NodeFilter', 'MutationObserver', 'Event', 'CustomEvent', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    Object.defineProperty(globalThis, key, { value: bound.has(key) ? dom.window[key].bind(dom.window) : dom.window[key], configurable: true });
  }
  Object.assign(globalThis, { indexedDB, IDBKeyRange, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, ResizeObserver: class { observe() {} disconnect() {} unobserve() {} } });
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  Object.defineProperty(navigator, 'locks', { value: { request: async (_name, _options, callback) => callback({}) } });
  return dom;
}
function tab(name) {
  const button = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent === name);
  assert.ok(button, name);
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
}

test('merged-session UI finishes first, resumes second after remount, discards it, and starts again', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, makeWorkout, makeSet } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const { mergeRestoredState } = require('../app/persistence/cloud-sync.ts');
  const a = defaultState(), b = defaultState(), first = makeWorkout('lb', 120, 'First QC session'), second = makeWorkout('lb', 120, 'Second QC session');
  first.exercises[0].sets = [makeSet('lb', { completed: true, actualReps: '6', actualWeight: 100, loadType: 'weighted' })];
  a.workouts = [first]; a.activeWorkoutId = first.id; b.workouts = [second]; b.activeWorkoutId = second.id;
  await storage.saveTrainingState(mergeRestoredState(a, b));
  let root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'app opens');
    [...document.querySelectorAll('button')].find(button => button.textContent.startsWith(first.name)).click();
    await until(() => document.querySelector('.workout-header'), 'first editor opens');
    const shell = document.querySelector('.workout-shell');
    assert.equal(shell.style.getPropertyValue('--live-header-height'), '', 'measurement does not freeze responsive header sizing');
    assert.notEqual(shell.style.getPropertyValue('--measured-header-height'), '', 'content offset is measured independently');
    [...document.querySelectorAll('.workout-header button')].find(button => button.textContent === 'Done').click();
    await until(() => document.querySelector('[role="alertdialog"]'), 'finish review opens');
    [...document.querySelectorAll('[role="alertdialog"] button')].find(button => button.textContent === 'Finish workout').click();
    await until(() => !document.querySelector('.workout-header'), 'first workout closes');
    await until(async () => (await storage.loadTrainingState())?.activeWorkoutId === second.id, 'finish transaction commits remaining pointer');
    const saved = await storage.loadTrainingState();
    assert.equal(saved.activeWorkoutId, second.id);
    assert.equal(saved.workouts.find(w => w.id === first.id).status, 'completed');
    root.unmount(); await wait(30);
    root = createRoot(document.getElementById('root')); root.render(React.createElement(App));
    await until(() => document.querySelector('.active-workout-card'), 'remaining workout resumes after relaunch');
    assert.ok(document.querySelector('.active-workout-card').textContent.includes(second.name));
    document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-header'), 'second editor opens');
    [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Discard').click();
    await until(() => document.querySelector('[role="alertdialog"]'), 'discard confirmation opens');
    [...document.querySelectorAll('[role="alertdialog"] button')].find(button => button.textContent === 'Discard').click();
    await until(() => !document.querySelector('.workout-header'), 'second workout closes');
    tab('Today'); await wait(30);
    [...document.querySelectorAll('button')].find(button => button.textContent.includes('Blank workout')).click();
    await until(() => document.querySelector('.workout-header'), 'new workout starts without being blocked');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('damaged-log screen downloads both diagnostic bundle and independently restorable checkpoint', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState } = require('../app/domain/training-types.ts');
  const { parseBackup } = require('../app/persistence/backup-tools.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const checkpoint = defaultState(); checkpoint.goals = ['Synthetic recovery goal']; checkpoint.coachProfile = 'Synthetic profile';
  await storage.saveSnapshot(checkpoint, 'before-restore');
  const raw = { version: 1, evidenceVersion: 999, damaged: 'keep me' };
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('coach-loop', 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('app', 'readwrite'); tx.objectStore('app').put(raw, 'training-state');
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
  const downloads = [], originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = blob => { downloads.push(blob); return 'blob:synthetic-qc'; }; URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = () => {};
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Download all recovery data'), 'recovery downloads appear without resetting corrupt log');
    [...document.querySelectorAll('button')].find(b => b.textContent === 'Download all recovery data').click();
    const bundle = JSON.parse(await downloads[0].text());
    assert.deepEqual(bundle.rawState, raw); assert.ok(bundle.recoveryCopies.length > 0);
    [...document.querySelectorAll('[aria-label="Recovery downloads"] button')].find(b => b.textContent.includes('before-restore')).click();
    const restored = parseBackup(await downloads[1].text());
    assert.deepEqual(restored.goals, checkpoint.goals); assert.equal(restored.coachProfile, checkpoint.coachProfile);
    assert.deepEqual(await storage.loadTrainingState(), raw, 'failed launch never overwrites damaged data');
  } finally { root.unmount(); await wait(30); dom.window.close(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});
