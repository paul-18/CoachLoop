/* Real React DOM + isolated synthetic IndexedDB. This is not an iOS browser test. */
const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, wait } = require("./helpers/dom-environment.cjs");

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
const storedWorkout = async (storage) => (await storage.loadTrainingState()).workouts[0];

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

async function choose(dom, label, action) {
  const trigger = document.querySelector(`[aria-label="${label}"]`); assert.ok(trigger, label);
  trigger.focus(); trigger.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, ctrlKey: false }));
  await until(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === action), `${action} available`);
  [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === action).click();
  await until(() => !document.querySelector('[role="menu"]'), 'menu closes');
}

function segmentedRun() {
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Stepper QC');
  const run = makeCardio('run'); run.name = 'Run';
  run.segments = [seg('a', 'run', 240), seg('b', 'walk', 60), seg('c', 'run', 240)];
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  return { state, workout, run };
}

test('v108: stepper shows current interval with dots and Interval N of M, labeled Done advances it', async () => {
  const dom = environment();
  const { state, workout } = segmentedRun();
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    assert.ok(document.querySelector('.activity-stepper'), 'stepper renders');
    assert.match(document.querySelector('.stepper-position').textContent, /Interval 1 of 3/);
    assert.equal(document.querySelectorAll('.stepper-dot').length, 3, 'three dots');
    assert.ok(button('Done: Run 4 min'), 'labeled Done on current card');
    assert.equal(document.body.textContent.includes('Edit detail'), false, 'no Edit detail anywhere');
    button('Done: Run 4 min').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Interval 2 of 3'), 'current advances to interval 2');
    await until(async () => (await storedActivity(storage)).segments[0].status === 'completed', 'interval 1 stored completed');
    const saved = await storedActivity(storage);
    assert.equal(saved.segments[0].actualDurationSec, null, 'as-prescribed keeps actuals null');
    assert.equal(saved.completed, false, 'finishing an interval does not complete the activity');
    button('Show all · 3 intervals').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens');
    assert.match(document.querySelector('.activity-stepper-list').textContent, /As prescribed/);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: complete-all logs a 13-interval run, then activity Done completes it', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Complete-all QC');
  const run = makeCardio('run'); run.name = 'Run';
  run.segments = [];
  for (let round = 1; round <= 6; round++) {
    run.segments.push(seg(`r${round}`, 'run', 240, { groupId: 'g', iteration: round }));
    run.segments.push(seg(`w${round}`, 'walk', 60, { groupId: 'g', iteration: round }));
  }
  run.segments.push(seg('t', 'run', 600));
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    assert.match(document.querySelector('.stepper-position').textContent, /Interval 1 of 13/);
    button('Show all · 13 intervals').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens for complete-all');
    button('Complete all remaining as prescribed').click();
    await until(async () => (await storedActivity(storage)).segments.every(s => s.status === 'completed'), 'all 13 intervals completed by one tap');
    assert.match(document.querySelector('.stepper-position').textContent, /All 13 intervals resolved/);
    button('Done: Run').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'activity Done completes the activity (tap 2)');
    const saved = await storedActivity(storage);
    assert.equal(saved.completedAsPlanned, true, 'all-as-prescribed activity is labeled as prescribed');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: Done undo restores the interval via toast and via Undo confirmation', async () => {
  const dom = environment();
  const { state, workout } = segmentedRun();
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    button('Done: Run 4 min').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Interval 2 of 3'), 'interval 1 done');
    await until(() => button('Undo'), 'toast Undo appears');
    button('Undo').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Interval 1 of 3'), 'toast Undo restores current interval');
    await until(async () => (await storedActivity(storage)).segments[0].status === 'unknown', 'interval 1 unknown again');
    button('Done: Run 4 min').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Interval 2 of 3'), 'interval 1 done again');
    button('Show all · 3 intervals').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens again');
    [...document.querySelectorAll('.stepper-part-text')][0].click();
    await until(() => button('Undo confirmation'), 'undo confirmation available');
    button('Undo confirmation').click();
    await until(async () => (await storedActivity(storage)).segments[0].status === 'unknown', 'Undo confirmation restores');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: Did-different path marks an interval Measured and keeps typed actuals', async () => {
  const dom = environment();
  const { state, workout } = segmentedRun();
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    const currentText = [...document.querySelectorAll('.stepper-current-text')][0];
    currentText.click();
    await until(() => [...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Actual sec')), 'expanded interval shows actual fields');
    const actualInput = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Actual sec')).querySelector('input');
    setValue(dom, actualInput, '250');
    await until(async () => (await storedActivity(storage)).segments[0].actualDurationSec === 250, 'typed actual stored');
    button('Mark actual').click();
    await until(async () => (await storedActivity(storage)).segments[0].status === 'modified', 'interval is Measured');
    button('Show all · 3 intervals').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens');
    assert.match(document.querySelector('.activity-stepper').textContent, /Measured/);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: 21-interval session shows text position plus dots, Show-all intervals are tappable out of order', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Long QC');
  const run = makeCardio('run'); run.name = 'Run';
  run.segments = Array.from({ length: 21 }, (_, i) => seg(`s${i}`, i % 2 ? 'walk' : 'run', i % 2 ? 60 : 240));
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    assert.match(document.querySelector('.stepper-position').textContent, /Interval 1 of 21/);
    assert.equal(document.querySelectorAll('.stepper-dot').length, 21, 'dots for all 21 intervals');
    button('Show all · 21 intervals').click();
    await until(() => document.querySelectorAll('.stepper-part-text').length === 21, 'show all lists 21 compact intervals');
    [...document.querySelectorAll('.stepper-part-text')][4].click();
    await until(() => [...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Actual sec')), 'interval 5 expands');
    const doneButtons = [...document.querySelectorAll('.stepper-done')];
    doneButtons[4].click();
    await until(async () => (await storedActivity(storage)).segments[4].status === 'completed', 'interval 5 done out of order');
    assert.match(document.querySelector('.stepper-position').textContent, /Interval 1 of 21/, 'current stays interval 1');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: activity-completion matrix — final part, all skipped, and add-to-completed reopen', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Matrix QC');
  const run = makeCardio('run'); run.name = 'Run';
  run.segments = [seg('a', 'run', 240)];
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    button('Done: Run 4 min').click();
    await until(async () => (await storedActivity(storage)).segments[0].status === 'completed', 'final interval done');
    assert.equal((await storedActivity(storage)).completed, false, 'final interval done does not complete the activity');
    button('Done: Run').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'activity action completes the activity');
    document.querySelector('[aria-label="Edit completed Run"]').click();
    await until(() => document.querySelector('.activity-card'), 'completed activity reopens for editing');
    button('Show all · 1 interval').click();
    await until(() => button('Add interval'), 'add interval available in show all');
    button('Add interval').click();
    await until(async () => (await storedActivity(storage)).completed === false, 'adding a part reopens the completed activity');
    await until(async () => (await storedActivity(storage)).segments.length === 2, 'new part added');
    assert.match(document.querySelector('.stepper-position').textContent, /Interval 2 of 2/, 'new interval becomes current');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: all-skipped activity is not complete', async () => {
  const dom = environment();
  const { state, workout } = segmentedRun();
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    button('Show all · 3 intervals').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens');
    [...document.querySelectorAll('.stepper-part-text')][0].click();
    await until(() => button('Skip'), 'skip available');
    button('Skip').click();
    await until(async () => (await storedActivity(storage)).segments[0].status === 'skipped', 'interval 1 skipped');
    button('Complete all remaining as prescribed').click();
    await until(async () => (await storedActivity(storage)).segments[1].status === 'completed', 'remaining intervals complete');
    assert.equal((await storedActivity(storage)).segments[0].status, 'skipped', 'skip survives complete-all');
    assert.equal((await storedActivity(storage)).completed, false, 'skipped intervals never complete the activity by themselves');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: post-session yoga card has visible notes and labeled Done and no stepper; yoga with segments shows the stepper', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Post-session QC');
  const yoga = makeCardio('yoga'); yoga.name = 'Yoga'; yoga.plannedDurationMin = 30;
  const bjj = makeCardio('grappling'); bjj.name = 'BJJ class';
  bjj.segments = [seg('a', 'other', 300), seg('b', 'other', 300)];
  workout.exercises = []; workout.cardio = [yoga, bjj];
  workout.blockOrder = [{ type: 'activity', id: yoga.id }, { type: 'activity', id: bjj.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Yoga');
    const card = document.querySelector('.activity-card');
    assert.ok(card, 'yoga card opens');
    assert.equal(card.querySelector('.activity-stepper'), null, 'no stepper for segment-free yoga');
    assert.equal(card.querySelector('button')?.textContent.includes('Add intervals'), false, 'no Add intervals for post-session types');
    const notes = [...card.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('What I did'));
    assert.ok(notes, 'notes field visible on the card, not behind a disclosure');
    assert.ok(button('Done: Yoga 30 min'), 'labeled Done for post-session yoga');
    button('Done: Yoga 30 min').click();
    await until(async () => (await storedActivity(storage, 0)).completed === true, 'yoga completes');
    await openActivity(dom, 'BJJ class');
    assert.ok(document.querySelector('.activity-stepper'), 'segments-exist rule: grappling with segments shows the stepper');
    assert.match(document.querySelector('.stepper-position').textContent, /Interval 1 of 2/);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: mobility session card lists moves read-only with visible notes and labeled Done', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Mobility QC');
  const mob = makeCardio('mobility'); mob.name = 'Morning mobility'; mob.plannedDurationMin = 10;
  mob.mobilityMoves = [
    { id: 'm1', name: 'Adductor rock-back', prescription: '2 x 8/side' },
    { id: 'm2', name: 'Calf stretch', prescription: '2 x 30 sec/side' },
  ];
  workout.exercises = []; workout.cardio = [mob]; workout.blockOrder = [{ type: 'activity', id: mob.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Morning mobility');
    const card = document.querySelector('.activity-card');
    assert.match(card.textContent, /Adductor rock-back/);
    assert.match(card.textContent, /Calf stretch/);
    assert.equal(card.querySelector('.activity-stepper'), null, 'no stepper, no pose cards in v108');
    const notes = [...card.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Your notes'));
    assert.ok(notes, 'notes visible on the mobility card');
    assert.ok(button('Done: Morning mobility 10 min'), 'labeled Done for mobility');
    button('Done: Morning mobility 10 min').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'mobility completes');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: slim force rows show plan text, hide inputs until Did different, and complete 6 efforts', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const { makeActivityEffort } = require('../app/domain/activity-logging.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Force QC');
  const force = makeCardio('force'); force.name = 'Sled';
  force.efforts = Array.from({ length: 6 }, () => {
    const effort = makeActivityEffort();
    effort.plannedDistanceM = 20; effort.plannedDurationSec = 60; effort.plannedLoad = 90;
    return effort;
  });
  workout.exercises = []; workout.cardio = [force]; workout.blockOrder = [{ type: 'activity', id: force.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Sled');
    const efforts = document.querySelector('.activity-efforts');
    assert.ok(efforts, 'efforts section renders');
    assert.match(efforts.textContent, /20 m · 60 sec · 90 lb/);
    assert.equal([...efforts.querySelectorAll('.activity-effort-actuals label')].some(l => l.textContent.trim().startsWith('Metres')), false, 'no visible Metres inputs before Did different');
    assert.equal([...efforts.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Did different').length, 6, 'Did different per effort');
    button('Did different').click();
    await until(() => [...efforts.querySelectorAll('.activity-effort-actuals label')].some(l => l.textContent.trim().startsWith('Metres')), 'Did different reveals inputs for that effort only');
    assert.equal([...efforts.querySelectorAll('.activity-effort-actuals label')].filter(l => l.textContent.trim().startsWith('Metres')).length, 1, 'only one effort expanded');
    for (let i = 0; i < 6; i++) {
      // Completed efforts keep their plan text (with a checkmark), so the next
      // uncompleted effort is found by its Complete aria-label, not by text.
      const done = [...efforts.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.startsWith('Complete effort'));
      assert.ok(done, `effort ${i + 1} labeled Done`);
      done.click();
      await until(async () => (await storedActivity(storage)).efforts.filter(e => e.completed).length === i + 1, `effort ${i + 1} stored complete`);
      if (i === 4) assert.match(efforts.textContent, /5\/6 done/, 'count tracks completions while the card is mounted');
    }
    const finalActivity = await storedActivity(storage);
    assert.equal(finalActivity.efforts.filter(e => e.completed).length, 6, 'all 6 efforts stored complete');
    assert.equal(finalActivity.completed, true, 'all efforts done completes the activity');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: move up/down reorders a mixed workout through blockOrder and persists after reload', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio, makeExercise } = require('../app/domain/training-types.ts');
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const { prepareLoadedState } = require('../app/persistence/migrations.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Move QC');
  const bench = makeExercise('lb', 60, 'Bench Press');
  const squat = makeExercise('lb', 60, 'Squat');
  const run = makeCardio('run'); run.name = 'Run';
  workout.exercises = [bench, squat]; workout.cardio = [run];
  workout.blockOrder = [{ type: 'exercise', id: bench.id }, { type: 'activity', id: run.id }, { type: 'exercise', id: squat.id }];
  state.workouts = [workout]; state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(prepareLoadedState(state));
  let root = createRoot(document.getElementById('root'));
  const orderShown = () => [...document.querySelectorAll('.exercise-card, .activity-card, button.completed-block')].map(card => {
    const title = card.querySelector('input[aria-label="Exercise name"], input[aria-label="Activity name"]');
    if (title) return title.value;
    const strong = card.querySelector('.completed-block-copy strong');
    return strong ? strong.textContent : card.textContent.slice(0, 20);
  });
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('.active-workout-card'), 'active workout ready');
    document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-header'), 'editor opens');
    assert.deepEqual(orderShown(), ['Bench Press', 'Run', 'Squat']);
    await openActivity(dom, 'Run');
    await choose(dom, 'Options for Run', 'Move up');
    await until(async () => (await storedWorkout(storage)).blockOrder[0].id === run.id, 'run moved up in blockOrder');
    assert.deepEqual(orderShown(), ['Run', 'Bench Press', 'Squat']);
    assert.deepEqual((await storedWorkout(storage)).exercises.map(e => e.id), [bench.id, squat.id], 'exercises[] untouched by moves');
    await choose(dom, 'Options for Run', 'Move down');
    await until(async () => (await storedWorkout(storage)).blockOrder[1].id === run.id, 'run moved back down');
    assert.deepEqual(orderShown(), ['Bench Press', 'Run', 'Squat']);
    root.unmount(); await wait(30);
    root = createRoot(document.getElementById('root')); root.render(React.createElement(App));
    await until(() => document.querySelector('.active-workout-card'), 'relaunch ready');
    document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-header'), 'editor reopens');
    assert.deepEqual(orderShown(), ['Bench Press', 'Run', 'Squat'], 'order persists after reload');
    const trigger = document.querySelector('[aria-label="Options for Bench Press"]');
    trigger.focus(); trigger.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, ctrlKey: false }));
    await until(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === 'Move up'), 'menu opens');
    const moveUp = [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === 'Move up');
    assert.equal(moveUp.getAttribute('aria-disabled'), 'true', 'Move up disabled at the top');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: summary run keeps tap parity — one labeled Done completes it', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Summary QC');
  const run = makeCardio('run'); run.name = 'Easy run'; run.plannedDurationMin = 30;
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Easy run');
    assert.equal(document.querySelector('.activity-stepper'), null, 'no stepper forced on a summary run');
    assert.ok(button('Done: Easy run 30 min'), 'labeled Done for summary run');
    button('Done: Easy run 30 min').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'one tap completes');
    assert.equal((await storedActivity(storage)).completedAsPlanned, true);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: label edit renders in cards and preview, pipe labels are rejected with a plain message', async () => {
  const dom = environment();
  const { state, workout } = segmentedRun();
  workout.cardio[0].segments = [seg('a', 'run', 600)];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    button('Show all · 1 interval').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens');
    [...document.querySelectorAll('.stepper-part-text')][0].click();
    await until(() => [...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Label')), 'label field appears');
    const labelInput = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Label')).querySelector('input');
    setValue(dom, labelInput, 'Tempo');
    await until(async () => (await storedActivity(storage)).segments[0].label === 'Tempo', 'label stored');
    assert.match(document.querySelector('.stepper-part-plan').textContent, /Tempo · 10 min/);
    setValue(dom, labelInput, 'A|B');
    await until(() => document.querySelector('[role="alert"]')?.textContent.includes('Labels cannot contain'), 'pipe rejection message shows');
    assert.equal((await storedActivity(storage)).segments[0].label, 'Tempo', 'invalid label never lands');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108: import preview lists parts and collapses repeat groups', async () => {
  const dom = environment();
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const { defaultState } = require('../app/domain/training-types.ts');
  await storage.saveTrainingState(defaultState());
  const root = createRoot(document.getElementById('root'));
  const buttonExact = (text, within = document) => [...within.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  try {
    root.render(React.createElement(App));
    await until(() => buttonExact('Start blank'), 'welcome opens');
    buttonExact('Start blank').click();
    await until(() => buttonExact('Import a plan') || [...document.querySelectorAll('button')].some(b => b.querySelector('strong')?.textContent === 'Import workout'), 'today actions appear');
    (buttonExact('Import a plan') || [...document.querySelectorAll('button')].find(b => b.querySelector('strong')?.textContent === 'Import workout')).click();
    await until(() => document.querySelector('[aria-label="FITLOG workout text"]'), 'import dialog opens');
    buttonExact('Load a segments example').click();
    await until(() => document.body.textContent.includes('Repeat 6x: Run 4 min + Walk 1 min'), 'group collapse line in preview');
    assert.match(document.body.textContent, /Run 10 min/);
    assert.equal(document.body.textContent.includes('13 planned segments'), false, 'old summary line is gone');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
