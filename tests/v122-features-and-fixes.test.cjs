const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { environment, until, tab, wait } = require('./helpers/dom-environment.cjs');

test('v122 Section 1: interchange, CSV, backup diff, and manifest fixes', () => {
  const { defaultState, makeWorkout, makeExercise, makeSet, makeCardio } = require('../app/domain/training-types.ts');
  const { workoutToText, buildCoachPrompt } = require('../app/interchange/coach-export.ts');
  const { exportCompletedHistory } = require('../app/interchange/history-export.ts');
  const { trainingCsvRows } = require('../app/interchange/training-csv.ts');
  const { workoutDifferences } = require('../app/persistence/backup-review.ts');

  const workout = makeWorkout('lb', 120, 'Upper Strength');
  workout.status = 'completed';
  workout.date = '2026-11-05';
  workout.completedAt = '2026-11-05T14:00:00.000Z';
  const bench = makeExercise('lb', 120, 'Bench Press');
  bench.sets = [
    makeSet('lb', { warmup: true, completed: true, loadType: 'weighted', plannedWeight: 135, actualWeight: 135, plannedReps: '5', actualReps: '5' }),
    makeSet('lb', { warmup: false, completed: true, loadType: 'weighted', plannedWeight: 185, actualWeight: 185, plannedReps: '5', actualReps: '5' }),
    makeSet('lb', { warmup: false, completed: true, loadType: 'weighted', plannedWeight: 185, actualWeight: 185, plannedReps: '5', actualReps: '5' }),
  ];
  workout.exercises = [bench];
  const circuit = makeCardio('circuit');
  circuit.name = 'Garage Circuit';
  circuit.completed = true;
  circuit.roundsDone = 4;
  workout.cardio = [circuit];
  workout.blockOrder = [{ type: 'exercise', id: bench.id }, { type: 'activity', id: circuit.id }];

  const text = workoutToText(workout);
  assert.match(text, /- Set W1: 135 lb total × 5 \(warm-up\)/, 'warm-up set uses W1 display label');
  assert.match(text, /- Sets 1–2: 185 lb total × 5/, 'working sets start at 1 and group cleanly');

  const state = defaultState();
  state.workouts = [workout];
  const historyTxt = exportCompletedHistory(state);
  assert.match(historyTxt, /Garage Circuit: 4 rounds done/, 'history export includes roundsDone for circuits');

  const csvRows = trainingCsvRows(state);
  const circuitRow = csvRows.find(r => r[4] === 'Garage Circuit');
  assert.ok(circuitRow, 'circuit row in CSV');
  assert.equal(circuitRow[23], '4 rounds done', 'CSV efforts column includes roundsDone when no efforts/segments exist');

  // Backup diff uses setDisplayNumbers (W1 vs 1)
  const modified = structuredClone(workout);
  modified.exercises[0].sets[1].actualWeight = 190;
  const diffs = workoutDifferences(workout, modified);
  assert.ok(diffs.some(d => d.includes('Bench Press, set 1 · actualWeight: 185 → 190')), 'working set 1 is labeled set 1 in backup diff');

  // Manifest checks
  const rootDir = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.orientation, 'any', 'manifest orientation allows tablet/desktop rotation by default');
  assert.equal(manifest.launch_handler?.client_mode, 'navigate-existing', 'manifest includes single-window launch_handler');
  assert.ok(manifest.screenshots.some(s => s.type === 'image/png' && s.form_factor === 'narrow'), 'narrow PNG screenshot present');
  assert.ok(manifest.screenshots.some(s => s.type === 'image/png' && s.form_factor === 'wide'), 'wide PNG screenshot present');
  assert.ok(fs.existsSync(path.join(rootDir, 'public/screenshot-narrow.png')));
  assert.ok(fs.existsSync(path.join(rootDir, 'public/screenshot-wide.png')));

  // Templates excluded from dated SAVED PLANS in coach prompt
  const template = structuredClone(workout);
  template.id = 'tmpl-1';
  template.name = 'Reusable Push Template';
  template.status = 'planned';
  template.isTemplate = true;
  state.workouts.push(template);
  const prompt = buildCoachPrompt(state, {
    mode: 'continue',
    days: 7,
    since: null,
    sinceAt: null,
    energy: '',
    sleep: '',
    soreness: '',
    timeAvailable: '',
    equipment: '',
    restrictions: '',
    schedule: '',
    request: '',
  }, '2026-11-06');
  assert.doesNotMatch(prompt, /Reusable Push Template/, 'reusable templates are not exported as dated upcoming plans');
});

test('v122 Feature #1 & #5: Personal Records (PR) detection and Superset A1/A2 alternating progression', () => {
  const { defaultState, makeWorkout, makeExercise, makeSet } = require('../app/domain/training-types.ts');
  const { workoutPersonalRecords } = require('../app/domain/personal-records.ts');
  const { linkSupersetWithNext, unlinkSuperset } = require('../app/domain/training-workflow.ts');
  const { supersetLabels, nextOpenBlock, nextRestTarget } = require('../app/domain/completion.ts');

  const state = defaultState();
  // Prior session with Bench Press 185 x 5 and Pull-up BW x 8
  const prior = makeWorkout('lb', 120, 'Prior Session');
  prior.status = 'completed';
  prior.date = '2026-11-01';
  prior.completedAt = '2026-11-01T12:00:00.000Z';
  const priorBench = makeExercise('lb', 120, 'Bench Press');
  priorBench.sets = [
    makeSet('lb', { completed: true, loadType: 'weighted', actualWeight: 185, actualReps: '5' }),
  ];
  const priorPullup = makeExercise('lb', 120, 'Pull-up');
  priorPullup.sets = [
    makeSet('lb', { completed: true, loadType: 'bodyweight', actualWeight: null, actualReps: '8' }),
  ];
  prior.exercises = [priorBench, priorPullup];
  prior.blockOrder = [{ type: 'exercise', id: priorBench.id }, { type: 'exercise', id: priorPullup.id }];

  // Current session
  let current = makeWorkout('lb', 120, 'Current Session');
  current.status = 'active';
  current.date = '2026-11-06';
  current.startedAt = '2026-11-06T12:00:00.000Z';
  const bench = makeExercise('lb', 120, 'Bench Press');
  bench.sets = [
    makeSet('lb', { completed: true, loadType: 'weighted', actualWeight: 185, actualReps: '5' }), // matches prior -> no PR
    makeSet('lb', { completed: true, loadType: 'weighted', actualWeight: 195, actualReps: '5' }), // new Load PR!
    makeSet('lb', { completed: false, loadType: 'weighted', plannedWeight: 195, plannedReps: '5' }),
  ];
  const pullup = makeExercise('lb', 120, 'Pull-up');
  pullup.sets = [
    makeSet('lb', { completed: true, loadType: 'bodyweight', actualWeight: null, actualReps: '10' }), // new Rep PR!
    makeSet('lb', { completed: false, loadType: 'bodyweight', plannedWeight: null, plannedReps: '10' }),
    makeSet('lb', { completed: false, loadType: 'bodyweight', plannedWeight: null, plannedReps: '10' }),
  ];
  const firstTime = makeExercise('lb', 120, 'First Time Lift');
  firstTime.sets = [
    makeSet('lb', { completed: true, loadType: 'weighted', actualWeight: 100, actualReps: '10' }),
  ];
  current.exercises = [bench, pullup, firstTime];
  current.blockOrder = [
    { type: 'exercise', id: bench.id },
    { type: 'exercise', id: pullup.id },
    { type: 'exercise', id: firstTime.id },
  ];
  state.workouts = [prior, current];

  const prs = workoutPersonalRecords(state, current);
  assert.equal(prs.has(bench.sets[0].id), false, 'matching prior weight/reps is not a PR');
  assert.equal(prs.get(bench.sets[1].id)?.kind, 'Load PR', 'heavier bench set is detected as Load PR');
  assert.equal(prs.get(pullup.sets[0].id)?.kind, 'Rep PR', 'more bodyweight reps is detected as Rep PR');
  assert.equal(prs.has(firstTime.sets[0].id), false, 'first-time exercise without prior history does not trigger false PR');

  // Superset linking & alternating round progression
  current = linkSupersetWithNext(current, bench.id);
  const labels = supersetLabels(current);
  assert.equal(labels.get(bench.id), 'A1');
  assert.equal(labels.get(pullup.id), 'A2');
  assert.equal(labels.has(firstTime.id), false);

  // Bench has 2 completed sets (Set 1, Set 2) and Pull-up has 1 completed set (Set 1).
  // Therefore in round-alternating order, the next open block should be Pull-up (A2, Set 2) to catch up to round 2!
  const nextOpen = nextOpenBlock(current);
  assert.equal(nextOpen?.type, 'exercise');
  assert.equal(nextOpen.exercise.id, pullup.id, 'nextOpenBlock alternates to A2 when A1 is ahead in completed sets');

  // After completing Bench Set 2, nextRestTarget should point to Pull-up Set 2
  const restAfterBench2 = nextRestTarget(current, bench.id, bench.sets[1].id);
  assert.equal(restAfterBench2?.type, 'exercise');
  assert.equal(restAfterBench2.exercise.id, pullup.id);
  assert.equal(restAfterBench2.set.id, pullup.sets[1].id, 'nextRestTarget alternates from A1 Set 2 to A2 Set 2');

  // Unlinking removes labels
  const unlinked = unlinkSuperset(current, bench.id);
  assert.equal(supersetLabels(unlinked).size, 0);
});

test('v122 UI Journey: Saved Templates library, PR badge in editor/finish/history, and Portrait Lock setting', async () => {
  const dom = environment();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState, makeWorkout, makeExercise, makeSet } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');

  const state = defaultState();
  state.settings.welcomeChoice = 'blank';
  const prior = makeWorkout('lb', 120, 'Push Baseline');
  prior.status = 'completed';
  prior.date = '2026-11-01';
  prior.completedAt = '2026-11-01T12:00:00.000Z';
  const bench = makeExercise('lb', 120, 'Bench Press');
  bench.sets = [
    makeSet('lb', { completed: true, loadType: 'weighted', plannedWeight: 185, actualWeight: 185, plannedReps: '5', actualReps: '5' }),
    makeSet('lb', { completed: true, loadType: 'weighted', plannedWeight: 185, actualWeight: 185, plannedReps: '5', actualReps: '5' }),
  ];
  const row = makeExercise('lb', 120, 'Barbell Row');
  row.sets = [
    makeSet('lb', { completed: true, loadType: 'weighted', plannedWeight: 155, actualWeight: 155, plannedReps: '8', actualReps: '8' }),
  ];
  prior.exercises = [bench, row];
  prior.blockOrder = [{ type: 'exercise', id: bench.id }, { type: 'exercise', id: row.id }];
  state.workouts = [prior];
  await storage.saveTrainingState(state);

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'app opens');

    // Landmark & document title checks
    assert.equal(document.getElementById('main-content')?.tagName, 'MAIN', '#main-content is a semantic <main> landmark');
    assert.equal(document.title, 'Today · Coach Loop');

    // Open History, expand Push Baseline, and save it as a template
    tab('History');
    await until(() => document.title === 'History · Coach Loop', 'document.title updates on History tab');
    const cardBtn = [...document.querySelectorAll('.history-card button')].find(b => b.textContent.includes('Push Baseline'));
    assert.ok(cardBtn, 'history card found');
    cardBtn.click();
    await until(() => document.querySelector('[aria-label="More options for Push Baseline"]'), 'history details open');
    const moreBtn = document.querySelector('[aria-label="More options for Push Baseline"]');
    moreBtn.focus();
    moreBtn.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false }));
    await until(() => [...document.querySelectorAll('[role="menuitem"]')].find(m => m.textContent.includes('Save as template')), 'Save as template menu item opens');
    [...document.querySelectorAll('[role="menuitem"]')].find(m => m.textContent.includes('Save as template')).click();

    // Switch to Today and verify Saved templates section appears
    tab('Today');
    await until(() => document.querySelector('.template-library'), 'Saved templates library rendered on Today');
    assert.match(document.querySelector('.template-library').textContent, /Push Baseline/);

    // Start workout from template -> starts an active copy while keeping template in state
    const startBtn = [...document.querySelectorAll('.template-card button')].find(b => b.textContent.trim() === 'Start');
    assert.ok(startBtn, 'Start button on template card');
    startBtn.click();
    await until(() => document.querySelector('.workout-header'), 'Active workout opens from template');

    // Link superset between Bench Press and Barbell Row
    const benchOptions = document.querySelector('[aria-label="Options for Bench Press"]');
    benchOptions.focus();
    benchOptions.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false }));
    await until(() => [...document.querySelectorAll('[role="menuitem"]')].find(m => m.textContent.includes('Link superset with Barbell Row')), 'Link superset menu item appears');
    [...document.querySelectorAll('[role="menuitem"]')].find(m => m.textContent.includes('Link superset with Barbell Row')).click();
    await until(() => document.querySelector('.superset-badge')?.textContent === 'A1', 'A1 superset badge rendered');

    // Enter a PR weight (205 lb x 5) on Bench Press Set 1 and complete it
    const weightInput = document.querySelector('input[aria-label*="Bench Press, Set 1, actual weight"]');
    assert.ok(weightInput, 'Bench weight input found');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(weightInput, '205');
    weightInput.dispatchEvent(new Event('input', { bubbles: true }));
    weightInput.dispatchEvent(new Event('blur', { bubbles: true }));

    const completeBtn = document.querySelector('button[aria-label="Complete Bench Press, Set 1"]');
    completeBtn.click();
    await until(() => document.querySelector('.set-pr-badge'), 'PR badge appears on record-breaking completed set');

    // Open Finish dialog and verify celebratory PR callout
    const finishBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done');
    finishBtn.click();
    await until(() => document.querySelector('.finish-pr-banner'), 'Finish Workout dialog shows PR celebration banner');
    assert.match(document.querySelector('.finish-pr-banner').textContent, /Bench Press/);

    // Verify template is still intact in storage alongside active workout
    const savedState = await storage.loadTrainingState();
    assert.ok(savedState.workouts.some(w => w.isTemplate && w.name === 'Push Baseline'), 'Template remains reusable in storage after starting');

    // Verify Portrait Lock setting in Settings -> Appearance & quick log
    const keepTraining = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Keep training');
    keepTraining.click();
    await until(() => !document.querySelector('.finish-pr-banner'), 'Finish dialog closes');
    document.querySelector('button[aria-label="Back to today"]').click();
    await until(() => document.querySelector('[role="tab"]'), 'Back on Today');
    tab('Settings');
    await until(() => document.body.textContent.includes('Appearance & quick log'), 'Settings open');
    const appearanceSummary = [...document.querySelectorAll('summary')].find(s => s.textContent.includes('Appearance & quick log'));
    appearanceSummary.click();
    await until(() => document.body.textContent.includes('Lock to portrait orientation'), 'Portrait lock option rendered in Settings');
  } finally {
    root.unmount();
    await wait(30);
    dom.window.close();
  }
});
