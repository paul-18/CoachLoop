/* Real React DOM + isolated synthetic IndexedDB. This is not an iOS browser test. */
const test = require('node:test'), assert = require('node:assert/strict');
const { indexedDB } = require('fake-indexeddb');
const { environment, until, tab, wait } = require("./helpers/dom-environment.cjs");

test('new-user guide routes to goals; example drafts cancel safely, append on Save, and persist after remount', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  await storage.saveTrainingState(defaultState());
  let root = createRoot(document.getElementById('root'));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  try {
    root.render(React.createElement(App));
    await until(() => button('Add goals'), 'first-use guide opens');
    assert.equal(document.querySelector('.today-bodyweight-nudge'), null, 'brand-new user has no overdue bodyweight reminder');
    button('Add goals').click();
    await until(() => document.querySelector('#training-goals')?.open, 'guide opens training goals in Settings');
    document.querySelector('#training-goals details').open = true;
    button('Try consistency goal').click();
    await until(() => document.querySelector('textarea'), 'example opens editor');
    assert.match(document.querySelector('textarea').value, /8 weeks/);
    assert.deepEqual((await storage.loadTrainingState()).goals, [], 'opening draft writes nothing');
    button('Cancel').click();
    await until(() => !document.querySelector('textarea'), 'Cancel closes');
    assert.deepEqual((await storage.loadTrainingState()).goals, []);
    button('Try consistency goal').click();
    await until(() => document.querySelector('textarea'), 'second draft opens');
    button('Save').click();
    await until(async () => (await storage.loadTrainingState()).goals.length === 1, 'first goal commits');
    const first = (await storage.loadTrainingState()).goals[0];
    button('Try strength goal').click();
    await until(() => document.querySelector('textarea'), 'next example opens');
    button('Save').click();
    await until(async () => (await storage.loadTrainingState()).goals.length === 2, 'second goal appends');
    const saved = await storage.loadTrainingState();
    assert.equal(saved.goals[0], first); assert.match(saved.goals[1], /controlled technique/);
    assert.equal(saved.workouts.length, 0); assert.equal(saved.coachProfile, '');
    root.unmount(); await wait(30);
    root = createRoot(document.getElementById('root')); root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'relaunch opens');
    tab('Coach'); await wait(30);
    assert.ok(document.querySelector('.coach-goals').textContent.includes(first), 'saved priorities appear on Coach');
    assert.equal(document.querySelector('.coach-goals').open, false, 'Coach priorities stay collapsed');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('Settings rejects bad backups, previews/cancels restore, merges newer goals, replaces completely, exports and reopens', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, makeWorkout, makeSet } = require('../app/domain/training-types.ts');
  const { parseBackup, serializeBackup } = require('../app/persistence/backup-tools.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const current = defaultState(), backup = defaultState();
  const now = '2026-10-04T12:00:00.000Z', older = '2026-09-01T12:00:00.000Z';
  current.goals = ['Current priority']; current.coachProfile = 'Current athlete context';
  current.goalsUpdatedAt = current.coachProfileUpdatedAt = now;
  current.workouts = Array.from({ length: 40 }, (_, i) => {
    const workout = makeWorkout('lb', 120, `Existing history ${i}`);
    Object.assign(workout, { status: 'completed', completedAt: now, date: '2026-10-01' });
    workout.exercises[0].sets = [makeSet('lb', { completed: true, loadType: 'weighted', actualWeight: 100, actualReps: '5' })];
    return workout;
  });
  backup.goals = ['Backup priority']; backup.coachProfile = 'Backup athlete context';
  backup.goalsUpdatedAt = backup.coachProfileUpdatedAt = backup.settingsUpdatedAt = older;
  backup.settings.colorTheme = 'peach';
  backup.bodyweightEntries = [{ id: 'backup-weight', date: '2026-09-01', weight: 170, unit: 'lb', updatedAt: older }];
  const restoredWorkout = makeWorkout('lb', 120, 'Backup session');
  Object.assign(restoredWorkout, { status: 'completed', completedAt: older, date: '2026-09-01' });
  backup.workouts = [restoredWorkout];
  await storage.saveTrainingState(current);
  const downloads = [], originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = blob => { downloads.push(blob); return 'blob:release-backup'; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = () => {};
  let root = createRoot(document.getElementById('root'));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  const upload = async text => {
    const input = document.querySelector('input[type="file"]'); assert.ok(input);
    Object.defineProperty(input, 'files', { value: [{ size: Buffer.byteLength(text), text: async () => text }], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(50);
  };
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'existing log opens');
    tab('Settings'); await until(() => button('Download full backup'), 'Settings opens');
    assert.equal(document.querySelector('.first-steps'), null, '40-session log has no starter guide above Settings');
    for (const text of ['{broken', JSON.stringify({ version: 1, evidenceVersion: 999 })]) {
      await upload(text);
      assert.equal(document.querySelector('[role="dialog"]'), null, 'bad backup never reaches restore confirmation');
      assert.deepEqual((await storage.loadTrainingState()).goals, current.goals);
    }
    const text = serializeBackup(backup);
    await upload(text);
    await until(() => button('Merge backup'), 'valid backup has review');
    assert.match(document.querySelector('[role="dialog"]').textContent, /Adds 1 workouts/);
    button('Cancel').click(); await until(() => !document.querySelector('[role="dialog"]'), 'preview cancels');
    assert.equal((await storage.loadTrainingState()).workouts.length, 40);
    await upload(text); button('Merge backup').click();
    await until(async () => (await storage.loadTrainingState()).workouts.length === 41, 'merge commits');
    await until(() => button('Download full backup'), 'UI returns after restore');
    const merged = await storage.loadTrainingState();
    assert.deepEqual(merged.goals, current.goals); assert.equal(merged.coachProfile, current.coachProfile);
    assert.equal(merged.bodyweightEntries.length, 1);
    await upload(text); button('Merge backup').click();
    await until(() => button('Download full backup') && !document.querySelector('[role="dialog"]'), 'duplicate merge completes');
    assert.equal((await storage.loadTrainingState()).workouts.length, 41, 'duplicate backup does not duplicate workouts');
    await upload(text);
    const method = document.querySelector('select[aria-label="Restore method"]');
    method.value = 'replace'; method.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => button('Complete restore'), 'complete restore selected');
    button('Complete restore').click();
    await until(async () => (await storage.loadTrainingState()).workouts.length === 1, 'complete restore commits');
    await until(() => button('Download full backup'), 'restored Settings opens');
    const replaced = await storage.loadTrainingState();
    assert.deepEqual(replaced.goals, backup.goals); assert.equal(replaced.coachProfile, backup.coachProfile);
    assert.deepEqual(replaced.bodyweightEntries, backup.bodyweightEntries); assert.equal(replaced.settings.colorTheme, 'peach');
    const copies = await storage.listSnapshots();
    const checkpoint = await storage.loadSnapshot(copies.find(c => c.reason === 'before-restore').id);
    assert.ok(checkpoint.state.workouts.some(w => w.name.startsWith('Existing history')), 'pre-restore checkpoint retains prior log');
    button('Download full backup').click();
    const exported = parseBackup(await downloads.at(-1).text());
    assert.deepEqual(exported.goals, backup.goals); assert.equal(exported.coachProfile, backup.coachProfile);
    assert.deepEqual(exported.bodyweightEntries, backup.bodyweightEntries); assert.equal(exported.workouts.length, 1);
    root.unmount(); await wait(30); root = createRoot(document.getElementById('root')); root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'relaunch opens');
    tab('Coach'); await until(() => document.querySelector('.coach-goals'), 'Coach opens after reload');
    assert.ok(document.querySelector('.coach-goals').textContent.includes('Backup priority'));
    tab('Settings'); await until(() => button('Download full backup'), 'Settings returns');
    assert.equal(document.querySelector('.first-steps'), null, 'guide stays absent after restored completed history');
  } finally { root.unmount(); await wait(30); dom.window.close(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});

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
