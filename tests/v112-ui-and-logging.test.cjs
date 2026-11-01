const test = require('node:test'), assert = require('node:assert/strict');
const { readFileSync } = require('node:fs'), { join } = require('node:path');
const { environment, until, wait } = require("./helpers/dom-environment.cjs");

const css = () => readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
const cssRule = (selector) => {
  const match = css().match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule exists in globals.css`);
  return match[1];
};

const seg = (id, kind, plannedDurationSec, extra = {}) => ({
  id, kind, plannedDurationSec, plannedDistanceM: null, actualDurationSec: null, actualDistanceM: null, status: "unknown", ...extra,
});

async function setup(dom, state, workout) {
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const { prepareLoadedState } = require('../app/persistence/migrations.ts');
  state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(prepareLoadedState(state));
  const root = createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
  await until(() => document.querySelector('.active-workout-card'), 'active workout is available');
  document.querySelector('.active-workout-card').click();
  await until(() => document.querySelector('.workout-header'), 'workout editor opens');
  return { root, storage };
}

const button = (text, within = document) => [...within.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const storedActivity = async (storage, index = 0) => (await storage.loadTrainingState()).workouts[0].cardio[index];

async function openActivity(dom, name) {
  const collapsed = document.querySelector(`[aria-label="Edit ${name}"]`) || document.querySelector(`[aria-label="Log ${name}"]`);
  assert.ok(collapsed, `collapsed card for ${name}`);
  collapsed.click();
  await until(() => document.querySelector('.activity-card'), 'activity card opens');
}

function setValue(dom, element, value) {
  const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

test('v112: Coach FITLOG disclosure wraps controls, boxes example, and avoids "part" wording', () => {
  const { FITLOG_V3_INSTRUCTIONS, parseFitlog } = require('../app/interchange/fitlog.ts');
  assert.doesNotMatch(FITLOG_V3_INSTRUCTIONS, /\bpart\b/i, 'FITLOG v3 instructions use interval/station, not part');
  assert.match(cssRule('.coach-quick-controls'), /flex-wrap:\s*wrap/, 'Coach quick controls wrap on narrow screens');
  assert.match(cssRule('.coach-format-disclosure'), /overflow:\s*hidden/, 'Coach format disclosure contains its children');
  assert.match(cssRule('.fitlog-example'), /white-space:\s*pre-wrap/, 'FITLOG example pre wraps long lines');
  assert.match(cssRule('.fitlog-example'), /overflow-wrap:\s*anywhere/, 'FITLOG example breaks long tokens instead of overflowing');

  // Whitespace before pipe in v1 fallback does not leak v2/v3 segment lines.
  const v1 = parseFitlog('[FITLOG:1]\nWORKOUT|Test|2026-11-01\nCARDIO|Run\nTYPE|run\nMODE |segments\nSEGMENT |run|4 min||\nDURATION|20\n[/FITLOG]', 'lb', {});
  assert.equal(v1.cardio.length, 1);
});

test('v112: segmented circuit has one rounds counter, Undo round, per-line stations, compact disclosure, and exports prescribed duration', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const { workoutToText } = require('../app/interchange/coach-export.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Circuit v112 QC');
  const circuit = makeCardio('circuit'); circuit.name = 'KB Circuit'; circuit.plannedDurationMin = 20;
  circuit.segments = [
    seg('p1', 'other', null, { label: 'Push-ups x15', groupId: 'g', iteration: 1 }),
    seg('s1', 'other', null, { label: 'Goblet squat x12', groupId: 'g', iteration: 1 }),
    seg('p2', 'other', null, { label: 'Push-ups x15', groupId: 'g', iteration: 2 }),
    seg('s2', 'other', null, { label: 'Goblet squat x12', groupId: 'g', iteration: 2 }),
  ];
  workout.exercises = []; workout.cardio = [circuit]; workout.blockOrder = [{ type: 'activity', id: circuit.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'KB Circuit');
    assert.equal(document.querySelector('.routine-rounds'), null, 'segmented circuit does not render a duplicate routine-rounds counter at the bottom');
    const rows = document.querySelectorAll('.activity-stepper-current .stepper-unit-station-row');
    assert.equal(rows.length, 2, 'each station in the current round renders on its own row');
    assert.equal(document.querySelector('details.activity-stepper-units')?.tagName, 'DETAILS', 'all-rounds station editor is tucked in a compact disclosure');
    assert.equal(button('Undo round'), undefined, 'Undo round hidden at 0 rounds done');

    button('Done round').click();
    await until(() => document.querySelector('.stepper-rounds-count')?.textContent === '1 round done', 'round 1 done');
    assert.ok(button('Undo round'), 'Undo round button appears after completing a round');
    button('Undo round').click();
    await until(() => document.querySelector('.stepper-rounds-count')?.textContent === '0 rounds done', 'Undo round restores round 1 to unknown');
    assert.equal((await storedActivity(storage)).segments[0].status, 'unknown');

    // Completing all rounds and then reopening allows Undo round to reopen the activity.
    button('Done: all rounds').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'all rounds complete');
    const completedWorkout = (await storage.loadTrainingState()).workouts[0];
    assert.match(workoutToText(completedWorkout), /Session duration: 20 min as prescribed/, 'rep-based segmented circuit exports prescribed session duration');
    document.querySelector('[aria-label="Edit completed KB Circuit"]').click();
    await until(() => button('Undo round'), 'Undo round available when editing completed circuit');
    button('Undo round').click();
    await until(async () => (await storedActivity(storage)).completed === false, 'Undo round reopens completed circuit');
    assert.equal(document.querySelector('.stepper-rounds-count')?.textContent, '1 round done');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v112: routine circuit Undo round button, roundsDone in export/completion/repeat, and dark prescription styling', () => {
  const { makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const { workoutToText } = require('../app/interchange/coach-export.ts');
  const { repeatWorkoutDraft, replanWorkoutDraft } = require('../app/domain/workout-copy.ts');
  const { hasCompletedActivityWork, unconfirmedActualActivities } = require('../app/domain/completion.ts');

  const workout = makeWorkout('lb', 60, 'AMRAP QC');
  const amrap = makeCardio('circuit', 'Garage AMRAP');
  amrap.plannedDurationMin = 15;
  amrap.roundsDone = 4;
  workout.exercises = [];
  workout.cardio = [amrap];
  workout.blockOrder = [{ type: 'activity', id: amrap.id }];

  assert.equal(hasCompletedActivityWork(amrap), true, 'roundsDone counts as activity work');
  assert.equal(unconfirmedActualActivities(workout).length, 1, 'uncompleted activity with roundsDone prompts before finishing');

  amrap.completed = true;
  amrap.actualDurationMin = 15;
  assert.match(workoutToText(workout), /Rounds completed: 4/, 'coach export includes rounds completed for routine circuit');

  const repeated = repeatWorkoutDraft(workout, '2026-11-02');
  assert.equal(repeated.cardio[0].roundsDone, undefined, 'repeatWorkoutDraft resets roundsDone');
  const replanned = replanWorkoutDraft(workout, '2026-11-02');
  assert.equal(replanned.cardio[0].roundsDone, undefined, 'replanWorkoutDraft resets roundsDone');

  assert.doesNotMatch(cssRule('.run-plan'), /border-left/, 'RunPlan uses dark card border, not coach-cue left border');
  assert.doesNotMatch(cssRule('.activity-instructions'), /border-left/, 'activity-instructions uses dark card border, not coach-cue left border');
});

test('v112: Sled effort Did different updates top row numbers while keeping prescribed visible, and undoing as-prescribed clears actuals', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const { makeActivityEffort } = require('../app/domain/activity-logging.ts');
  const { unconfirmedActualActivities } = require('../app/domain/completion.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Sled v112 QC');
  const force = makeCardio('force', 'Sled Push');
  const e1 = makeActivityEffort(); e1.plannedDistanceM = 20; e1.plannedDurationSec = 45; e1.plannedLoad = 135;
  const e2 = makeActivityEffort(); e2.plannedDistanceM = 20; e2.plannedDurationSec = 45; e2.plannedLoad = 135;
  force.efforts = [e1, e2];
  workout.exercises = []; workout.cardio = [force]; workout.blockOrder = [{ type: 'activity', id: force.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Sled Push');
    const row = document.querySelector('.activity-effort');
    assert.equal(row.querySelector('.activity-effort-plan-text').textContent, '20 m · 45 sec · 135 lb');

    // Complete as prescribed, then undo: actuals reset to null so unconfirmed-actuals does not fire.
    button('Done', row).click();
    await until(async () => (await storedActivity(storage)).efforts[0].completed === true, 'effort completed');
    button('Done', row).click();
    await until(async () => (await storedActivity(storage)).efforts[0].completed === false, 'effort undone');
    const afterUndoWorkout = (await storage.loadTrainingState()).workouts[0];
    assert.equal(unconfirmedActualActivities(afterUndoWorkout).length, 0, 'undoing as-prescribed effort leaves no unconfirmed actuals');

    // Enter a different load under Did different: top text updates to show what was done + prescribed.
    button('Did different', row).click();
    await until(() => row.querySelector('.activity-effort-actuals'), 'actuals open');
    const loadInput = [...row.querySelectorAll('.activity-effort-actuals input')][1];
    setValue(dom, loadInput, '160');
    await until(() => row.querySelector('.activity-effort-plan-text').textContent.includes('160 lb'), 'top row updates with performed load');
    assert.match(row.querySelector('.activity-effort-plan-text').textContent, /20 m · 45 sec · 160 lb · prescribed 20 m · 45 sec · 135 lb/);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v112: header collapse button, no Logging style dropdown in UI, and Focus mode auto-expands next exercise', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeExercise, makeSet, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 0, 'Focus Flow QC');
  const ex1 = makeExercise('lb', 0, 'Squat'); ex1.sets = [makeSet('lb', { plannedWeight: 185, plannedReps: '5' })];
  const ex2 = makeExercise('lb', 0, 'Bench'); ex2.sets = [makeSet('lb', { plannedWeight: 135, plannedReps: '5' })];
  const run = makeCardio('run', 'Easy Run'); run.plannedDurationMin = 20;
  workout.exercises = [ex1, ex2]; workout.cardio = [run];
  workout.blockOrder = [{ type: 'exercise', id: ex1.id }, { type: 'exercise', id: ex2.id }, { type: 'activity', id: run.id }];
  const { root } = await setup(dom, state, workout);
  try {
    // Collapse Squat via its header arrow button, then reopen it.
    document.querySelector('[aria-label="Collapse Squat"]').click();
    await until(() => document.querySelector('[aria-label="Expand Squat"]'), 'Squat collapses to summary bar');
    document.querySelector('[aria-label="Expand Squat"]').click();
    await until(() => document.querySelector('[aria-label="Collapse Squat"]'), 'Squat reopens');

    // Collapse Bench, then complete Squat Set 1: Bench auto-expands!
    document.querySelector('[aria-label="Collapse Bench"]').click();
    await until(() => document.querySelector('[aria-label="Expand Bench"]'), 'Bench collapsed');
    document.querySelector('[aria-label="Complete Squat, Set 1"]').click();
    await until(() => document.querySelector('[aria-label="Review Squat"]'), 'Squat completed and collapsed');
    await until(() => document.querySelector('[aria-label="Collapse Bench"]'), 'Bench automatically expands when Squat finishes');

    // Open Easy Run: no Logging style dropdown inside More details.
    await openActivity(dom, 'Easy Run');
    assert.equal(document.body.textContent.includes('Logging style'), false, 'Logging style dropdown removed from activity UI');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v113: AMRAP exercise rows, compact Minutes + Options row, single-exercise auto-advance to activities, and per-line preview rows', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeExercise, makeSet, makeCardio } = require('../app/domain/training-types.ts');
  const { previewSegmentRows } = require('../app/domain/activity-segments.ts');
  const rows = previewSegmentRows([
    { id: '1', kind: 'run', plannedDurationSec: 240, plannedDistanceM: 1000, actualDurationSec: null, actualDistanceM: null, status: 'unknown', groupId: 'g1', iteration: 1, label: 'Tempo' },
    { id: '2', kind: 'walk', plannedDurationSec: 60, plannedDistanceM: null, actualDurationSec: null, actualDistanceM: null, status: 'unknown', groupId: 'g1', iteration: 1 },
  ]);
  assert.deepEqual(rows.map(r => r.text), ['Repeat 1x', 'Tempo · 4 min · 1 km', 'Walk 1 min']);

  const state = defaultState(), workout = makeWorkout('lb', 0, 'v113 Compact QC');
  const squat = makeExercise('lb', 0, 'Squat'); squat.sets = [makeSet('lb', { plannedWeight: 185, plannedReps: '5' })];
  const amrap = makeCardio('circuit', 'Garage AMRAP'); amrap.plannedDurationMin = 12;
  amrap.intervals = '12 min AMRAP: 10 burpees, 15 kettlebell swings (24 kg), 200 m run';
  const mob = makeCardio('mobility', 'Thoracic Recovery'); mob.plannedDurationMin = 12;
  workout.exercises = [squat]; workout.cardio = [amrap, mob];
  workout.blockOrder = [{ type: 'exercise', id: squat.id }, { type: 'activity', id: amrap.id }, { type: 'activity', id: mob.id }];
  const { root } = await setup(dom, state, workout);
  try {
    // Completing the only exercise automatically opens the next incomplete activity (Garage AMRAP).
    document.querySelector('[aria-label="Complete Squat, Set 1"]').click();
    await until(() => document.querySelector('.amrap-plan'), 'Garage AMRAP opens automatically and renders .amrap-plan');
    assert.deepEqual([...document.querySelectorAll('.amrap-plan li')].map(li => li.textContent.trim()), ['110 burpees', '215 kettlebell swings (24 kg)', '3200 m run']);
    assert.ok(document.querySelector('.activity-basics-row > .activity-basics') && document.querySelector('.activity-basics-row > .activity-details'), 'Minutes and Options share .activity-basics-row');

    // Completing Garage AMRAP automatically opens the next incomplete activity (Thoracic Recovery).
    button('Done: Garage AMRAP 12 min').click();
    await until(() => button('Done: Thoracic Recovery 12 min'), 'Thoracic Recovery opens automatically when Garage AMRAP completes');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
