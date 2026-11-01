/* Real React DOM + isolated synthetic IndexedDB. This is not an iOS browser test:
   jsdom cannot measure layout, so layout fixes are pinned two ways — the DOM
   structure the fix produces, plus the globals.css rules the fix adds. */
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

function makeWorkoutWith(dom, build) {
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'UI fixes QC');
  build(workout);
  workout.exercises = [];
  return { state, workout };
}

test('v108-ui-fixes: current-interval card keeps plan and intensity apart and keeps the labeled Done', async () => {
  const dom = environment();
  const { makeCardio } = require('../app/domain/training-types.ts');
  const { state, workout } = makeWorkoutWith(dom, (workout) => {
    const run = makeCardio('run'); run.name = 'Run'; run.intensity = 'Easy conversational effort';
    run.segments = [seg('a', 'run', 240), seg('b', 'walk', 60), seg('c', 'run', 240)];
    workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  });
  const { root } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    const plan = document.querySelector('.activity-stepper-current .stepper-part-plan');
    const intensity = document.querySelector('.activity-stepper-current .stepper-part-intensity');
    assert.ok(plan, 'current card has a plan element');
    assert.ok(intensity, 'current card has an intensity element');
    assert.equal(plan.textContent, 'Run 4 min', 'plan element holds only the plan, never the intensity');
    assert.equal(intensity.textContent, 'Easy conversational effort');
    assert.equal(intensity.parentElement, plan.parentElement, 'intensity is a sibling line, not glued into the plan');
    assert.notEqual(intensity, plan);
    assert.ok(button('Done: Run 4 min'), 'labeled Done action kept on the current card');
    assert.match(cssRule('.stepper-current-text'), /flex-direction:\s*column/, 'current card stacks plan over intensity');
    assert.ok(css().includes('.stepper-part-intensity'), 'intensity has its own quiet-line rule');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108-ui-fixes: Show-all rows and group rows keep text, status and actions apart', async () => {
  const dom = environment();
  const { makeCardio } = require('../app/domain/training-types.ts');
  const { repeatedSegments } = require('../app/domain/activity-segments.ts');
  const { state, workout } = makeWorkoutWith(dom, (workout) => {
    const run = makeCardio('run'); run.name = 'Run';
    run.segments = [...repeatedSegments([seg('p1', 'run', 240), seg('p2', 'walk', 60)], 2), seg('u', 'run', 600, { plannedDistanceM: 2000 })];
    workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  });
  const { root } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    button('Show all · 5 intervals').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens');
    const parts = [...document.querySelectorAll('.activity-stepper-part')];
    assert.equal(parts.length, 5, 'every interval gets its own row');
    for (const part of parts) {
      assert.ok(part.querySelector('.stepper-part-text'), 'row has a tappable text line');
      assert.ok(part.querySelector('.stepper-part-status'), 'row has its own status text');
      assert.ok(part.querySelector('.stepper-done'), 'unknown row has its own Done button');
    }
    const group = document.querySelector('.activity-segment-group');
    assert.ok(group, 'repeat group row renders');
    assert.ok(group.querySelector('button'), 'group row has its own action button');
    assert.match(cssRule('.activity-stepper-part'), /display:\s*grid/, 'interval rows are grid rows, not inline runs');
    assert.match(cssRule('.stepper-part-status'), /white-space:\s*nowrap/, 'status never wraps mid-word');
    assert.match(cssRule('.stepper-done'), /min-height:\s*44px/, 'Done keeps a 44px target');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108-ui-fixes: import preview Category control is full-width in the same place for every block', async () => {
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
    setValue(dom, document.querySelector('[aria-label="FITLOG workout text"]'), '[FITLOG:2]\nWORKOUT|Preview QC|2026-01-15\nCARDIO|Yoga after Down Dog\nTYPE|yoga\nMODE|summary\nDURATION|30\n[/FITLOG]');
    buttonExact('Review import').click();
    await until(() => document.querySelector('[aria-label="Category for Yoga after Down Dog"]'), 'preview Category control appears');
    const select = document.querySelector('[aria-label="Category for Yoga after Down Dog"]');
    assert.ok(select.classList.contains('w-full'), 'Category select is full-width');
    assert.equal(select.classList.contains('max-w-36'), false, 'no truncation cap on the Category select');
    assert.equal(select.closest('.justify-between'), null, 'Category no longer shares a justify-between row with the name');
    assert.equal(select.closest('label').parentElement.querySelector('p').textContent, 'Yoga after Down Dog', 'name sits on its own line above the control');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v111: effort rows show the plan once as its own element, with a leading check and a plain Done', async () => {
  const dom = environment();
  const { makeCardio } = require('../app/domain/training-types.ts');
  const { makeActivityEffort } = require('../app/domain/activity-logging.ts');
  const { state, workout } = makeWorkoutWith(dom, (workout) => {
    const force = makeCardio('force'); force.name = 'Sled Push and Pull Drag';
    force.efforts = Array.from({ length: 2 }, () => {
      const effort = makeActivityEffort();
      effort.plannedDistanceM = 20; effort.plannedDurationSec = 60; effort.plannedLoad = 90;
      return effort;
    });
    workout.cardio = [force]; workout.blockOrder = [{ type: 'activity', id: force.id }];
  });
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Sled Push and Pull Drag');
    const rows = [...document.querySelectorAll('.activity-effort')];
    assert.equal(rows.length, 2, 'two effort rows');
    assert.equal(document.querySelectorAll('span.activity-effort-plan-text').length, 2, 'plan appears exactly once per row, in its own plan element');
    assert.equal(rows[0].querySelector('.activity-effort-plan-text').textContent, '20 m · 60 sec · 90 lb', 'plan element holds only the plan');
    const doneButtons = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Done');
    assert.ok(doneButtons.length >= 2, 'plain Done action per effort');
    assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Did different').length, 2, 'Did different per effort');
    const first = [...rows[0].querySelectorAll('button')].find(b => b.textContent.trim() === 'Done');
    first.click();
    await until(async () => (await storedActivity(storage)).efforts[0].completed === true, 'first effort stored complete');
    assert.equal([...rows[0].querySelectorAll('button')].find(b => b.textContent.trim() === 'Done'), first, 'same button node after completing: no layout shift to a new control');
    assert.ok(rows[0].querySelector('.activity-effort-state svg'), 'completed row carries the check in the leading slot, not glued onto the plan');
    assert.equal(rows[0].querySelector('.activity-effort-plan-text').textContent, '20 m · 60 sec · 90 lb', 'plan unchanged by completion');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v108-ui-fixes: stored segmented yoga still renders the stepper (parser block is for new imports only)', async () => {
  const dom = environment();
  const { makeCardio } = require('../app/domain/training-types.ts');
  const { state, workout } = makeWorkoutWith(dom, (workout) => {
    const yoga = makeCardio('yoga'); yoga.name = 'Yoga flow with parts';
    yoga.segments = [seg('a', 'other', 300), seg('b', 'other', 300), seg('c', 'rest', 60)];
    workout.cardio = [yoga]; workout.blockOrder = [{ type: 'activity', id: yoga.id }];
  });
  const { root } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Yoga flow with parts');
    assert.ok(document.querySelector('.activity-stepper'), 'segments-exist rule unchanged: stored segmented yoga shows the stepper');
    assert.match(document.querySelector('.stepper-position').textContent, /Interval 1 of 3/);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
