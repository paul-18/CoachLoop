/* Real shell/Settings/IndexedDB; only the service-worker activation endpoint is simulated. */
const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, tab, wait } = require('./helpers/dom-environment.cjs');
const { IDBObjectStore } = require('fake-indexeddb');

test('update UI blocks active workouts and failed saves; successful restart commits and retains the log', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const offlinePath = require.resolve('../app/pwa/use-offline-status.ts');
  const previousModule = require.cache[offlinePath];
  let activation = 0, attempts = 0;
  const storage = require('../app/persistence/training-storage.ts');
  require.cache[offlinePath] = { id: offlinePath, filename: offlinePath, loaded: true, exports: {
    useOfflineStatus: () => ({ offlineReady: 'ready', updateReady: true, release: 'previous-release', checkUpdates: async () => {}, applyUpdate: async save => {
      attempts++; await save();
      assert.deepEqual((await storage.loadTrainingState()).goals, ['Retain this priority']);
      activation++;
    } }),
  } };
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 120, 'Mid-workout update QC');
  state.goals = ['Retain this priority']; state.coachProfile = 'Retain this context';
  state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(state);
  let root = createRoot(document.getElementById('root'));
  const restart = () => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Restart to update');
  const put = IDBObjectStore.prototype.put;
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'app opens');
    tab('Settings'); await until(() => restart(), 'waiting update is shown');
    assert.equal(restart().disabled, true, 'cannot update during an active workout');
    restart().click(); await wait(30); assert.equal(attempts, 0);
    root.unmount(); await wait(30);
    const finished = structuredClone(state);
    finished.workouts[0].status = 'completed'; finished.workouts[0].completedAt = new Date().toISOString(); finished.activeWorkoutId = null;
    await storage.saveTrainingState(finished);
    root = createRoot(document.getElementById('root')); root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'completed log reopens');
    tab('Settings'); await until(() => restart() && !restart().disabled, 'saved idle log can restart');
    IDBObjectStore.prototype.put = function () { throw new DOMException('QC update flush failed', 'QuotaExceededError'); };
    restart().click();
    await until(() => attempts === 1 && restart(), 'failed flush returns to Settings');
    assert.equal(activation, 0, 'save failure must not activate update');
    assert.deepEqual((await storage.loadTrainingState()).goals, finished.goals);
    IDBObjectStore.prototype.put = put;
    restart().click();
    await until(() => activation === 1, 'successful flush activates once');
    assert.match(document.querySelector('[role="status"]').textContent, /Applying update/);
    root.unmount(); await wait(30); root = createRoot(document.getElementById('root')); root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'simulated post-update launch opens');
    const retained = await storage.loadTrainingState();
    assert.deepEqual(retained.goals, finished.goals); assert.equal(retained.coachProfile, finished.coachProfile);
    assert.equal(retained.workouts[0].id, workout.id); assert.equal(retained.workouts[0].status, 'completed');
    assert.ok(document.body.textContent.includes('v88'));
  } finally {
    IDBObjectStore.prototype.put = put; root.unmount(); await wait(30); dom.window.close();
    if (previousModule) require.cache[offlinePath] = previousModule; else delete require.cache[offlinePath];
  }
});
