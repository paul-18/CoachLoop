/* Real React DOM + isolated synthetic IndexedDB. This is not an iOS browser test:
   jsdom cannot measure layout, so spacing/density fixes are pinned two ways — the
   DOM structure the fix produces, plus the globals.css rules the fix adds. */
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

// Reload without re-saving: proves a value survived a fresh app start from storage.
async function reopen() {
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const root = createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
  await until(() => document.querySelector('.active-workout-card'), 'active workout is available after reload');
  document.querySelector('.active-workout-card').click();
  await until(() => document.querySelector('.workout-header'), 'workout editor opens after reload');
  return root;
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

// Every user-visible string inside one activity card's stepper: rendered text plus
// the labels a screen reader announces (aria-label) and hover titles. Class names
// are not user-visible and are excluded by construction.
const cardFor = (name) => [...document.querySelectorAll('.activity-card')].find(card => card.querySelector('input[aria-label="Activity name"]')?.value === name);
function stepperVisibleStrings(card = document) {
  const stepper = card.querySelector('.activity-stepper');
  assert.ok(stepper, 'stepper renders');
  const parts = [stepper.textContent];
  stepper.querySelectorAll('[aria-label]').forEach(el => parts.push(el.getAttribute('aria-label')));
  stepper.querySelectorAll('[title]').forEach(el => parts.push(el.getAttribute('title')));
  return parts.join(' ');
}

async function quickAdd(dom, kind, minutes) {
  const row = document.querySelector('.stepper-quick-add');
  assert.ok(row, 'quick-add row renders');
  const chip = [...row.querySelectorAll('.stepper-quick-chips button')].find(b => b.textContent.trim() === kind);
  assert.ok(chip, `${kind} chip`);
  chip.click();
  const input = row.querySelector('[aria-label="Quick-add minutes"]');
  assert.ok(input, 'quick-add minutes field');
  setValue(dom, input, String(minutes));
  await until(() => {
    const current = document.querySelector('.stepper-quick-add');
    const add = current && [...current.querySelectorAll('button')].find(b => b.textContent.trim() === 'Add');
    return Boolean(add && !add.disabled);
  }, 'quick-add Add enables after typing minutes');
  const add = [...document.querySelector('.stepper-quick-add').querySelectorAll('button')].find(b => b.textContent.trim() === 'Add');
  add.click();
}

test('v111: quick-add chains 5 run + 5 walk + 4 run with no form navigation, row stays ready', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Quick-add QC');
  const run = makeCardio('run'); run.name = 'Run';
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    button('Add intervals').click();
    await until(() => document.querySelector('.stepper-quick-add'), 'quick-add row appears after Add intervals');
    await quickAdd(dom, 'Run', 5);
    await until(async () => (await storedActivity(storage)).segments?.length === 1, 'first quick interval stored');
    // The row stays ready between adds: minutes cleared, chips still there.
    assert.equal(document.querySelector('[aria-label="Quick-add minutes"]').value, '', 'minutes cleared for the next interval');
    assert.ok(document.querySelector('.stepper-quick-add'), 'quick-add row still present after an add');
    await quickAdd(dom, 'Walk', 5);
    await until(async () => (await storedActivity(storage)).segments?.length === 2, 'second quick interval stored');
    await quickAdd(dom, 'Run', 4);
    await until(async () => (await storedActivity(storage)).segments?.length === 3, 'third quick interval stored');
    const saved = await storedActivity(storage);
    assert.deepEqual(saved.segments.map(s => s.kind), ['run', 'walk', 'run'], 'kinds in tapped order');
    assert.deepEqual(saved.segments.map(s => s.plannedDurationSec), [300, 300, 240], '5 min, 5 min, 4 min');
    assert.ok(saved.segments.every(s => s.status === 'unknown'), 'quick intervals start unconfirmed');
    // Tapping an existing interval still expands it for inline editing: one tap + type + done, no extra screen.
    document.querySelector('.stepper-current-text').click();
    await until(() => [...document.querySelectorAll('label')].some(l => l.textContent.trim().startsWith('Actual sec')), 'interval expands to actual fields');
    const actual = [...document.querySelectorAll('.activity-stepper-expanded input')].find(input => input.closest('label')?.textContent.trim().startsWith('Actual sec'));
    assert.ok(actual, 'Actual sec field in expanded interval');
    setValue(dom, actual, '310');
    button('Mark actual').click();
    await until(async () => (await storedActivity(storage)).segments[0].status === 'modified', 'edited interval stored as measured');
    assert.equal((await storedActivity(storage)).segments[0].actualDurationSec, 310, 'typed actual kept');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v111: plain words — no "part" string renders in the generic, circuit, or swim stepper', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Plain words QC');
  const run = makeCardio('run'); run.name = 'Run';
  run.segments = [seg('a', 'run', 240), seg('b', 'walk', 60), seg('c', 'other', null)];
  const circuit = makeCardio('circuit'); circuit.name = 'Garage circuit';
  circuit.segments = [
    seg('p1', 'other', null, { label: 'Push-ups x15', groupId: 'g', iteration: 1 }),
    seg('s1', 'other', null, { label: 'Goblet squat x12', groupId: 'g', iteration: 1 }),
  ];
  const swim = makeCardio('swim'); swim.name = 'Pool swim';
  swim.segments = [
    seg('f1', 'other', 60, { label: 'Freestyle', plannedDistanceM: 50, groupId: 's', iteration: 1 }),
    seg('f2', 'other', 60, { label: 'Freestyle', plannedDistanceM: 50, groupId: 's', iteration: 1 }),
  ];
  workout.exercises = []; workout.cardio = [run, circuit, swim];
  workout.blockOrder = workout.cardio.map(a => ({ type: 'activity', id: a.id }));
  const { root } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    assert.match(cardFor('Run').querySelector('.stepper-position').textContent, /Interval 1 of 3/, 'generic position uses Interval');
    assert.ok(button('Show all · 3 intervals'), 'Show-all counts intervals');
    assert.doesNotMatch(stepperVisibleStrings(cardFor('Run')), /part/i, 'generic stepper shows no "part" string');
    assert.match(stepperVisibleStrings(cardFor('Run')), /Interval/, 'unlabeled other interval reads Interval, not Part');
    document.querySelector('[aria-label="Edit Garage circuit"]')?.click();
    await until(() => cardFor('Garage circuit')?.querySelector('.grouped-activity-stepper'), 'circuit stepper opens');
    assert.match(cardFor('Garage circuit').querySelector('.stepper-position').textContent, /Round 1 of 1/, 'circuit position uses Round');
    assert.doesNotMatch(stepperVisibleStrings(cardFor('Garage circuit')), /part/i, 'circuit stepper shows no "part" string');
    await openActivity(dom, 'Pool swim');
    button('Show all · 1 set', cardFor('Pool swim')).click();
    await until(() => cardFor('Pool swim').querySelector('.activity-stepper-list'), 'swim show all opens');
    assert.match(cardFor('Pool swim').querySelector('.stepper-position').textContent, /Set 1 of 1/, 'swim position uses Set');
    assert.doesNotMatch(stepperVisibleStrings(cardFor('Pool swim')), /part/i, 'swim stepper shows no "part" string');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

function circuitActivity() {
  const { makeCardio } = require('../app/domain/training-types.ts');
  const circuit = makeCardio('circuit'); circuit.name = 'Garage circuit';
  circuit.segments = [
    seg('p1', 'other', null, { label: 'Push-ups x15', groupId: 'g', iteration: 1 }),
    seg('s1', 'other', null, { label: 'Goblet squat x12', groupId: 'g', iteration: 1 }),
    seg('r1', 'rest', 20, { groupId: 'g', iteration: 1 }),
    seg('p2', 'other', null, { label: 'Push-ups x15', groupId: 'g', iteration: 2 }),
    seg('s2', 'other', null, { label: 'Goblet squat x12', groupId: 'g', iteration: 2 }),
    seg('r2', 'rest', 20, { groupId: 'g', iteration: 2, status: 'skipped' }),
  ];
  return circuit;
}

test('v111: circuit stations always visible, Done round per round, counter, prescribed count completes, Add another round goes beyond', async () => {
  const dom = environment();
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Circuit QC');
  workout.exercises = []; workout.cardio = [circuitActivity()]; workout.blockOrder = [{ type: 'activity', id: workout.cardio[0].id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Garage circuit');
    // Stations visible without expanding anything; there is no Show-all hiding for circuits.
    assert.ok(!button('Show all'), 'no Show-all button for circuits');
    assert.ok(document.querySelector('.activity-stepper-units'), 'station list renders by default');
    assert.match(document.querySelector('.activity-stepper-units').textContent, /Push-ups x15/, 'stations listed without expanding');
    assert.match(document.querySelector('.activity-stepper-units').textContent, /Goblet squat x12/);
    assert.equal(document.querySelector('.stepper-rounds-count').textContent, '0 rounds done', 'rounds counter always visible');
    // The grouped current card keeps plan and action as separate elements.
    assert.equal(document.querySelector('.activity-stepper-current .stepper-part-plan').textContent, 'Round 1 of 2', 'current card plan is its own element');
    assert.ok(button('Done round'), 'one Done round action');
    button('Done round').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Round 2 of 2'), 'round 2 becomes current');
    assert.equal(document.querySelector('.stepper-rounds-count').textContent, '1 round done', 'counter increments by one round');
    const afterOne = await storedActivity(storage);
    assert.deepEqual(afterOne.segments.slice(0, 3).map(s => s.status), ['completed', 'completed', 'completed'], 'Done round completes only that round');
    assert.deepEqual(afterOne.segments.slice(3).map(s => s.status), ['unknown', 'unknown', 'skipped'], 'round 2 untouched, skip untouched');
    assert.equal(afterOne.completed, false, 'one round does not complete the activity');
    // Reaching the prescribed count completes the activity.
    button('Done round').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'prescribed count completes the activity');
    await until(() => document.querySelector('[aria-label="Edit completed Garage circuit"]'), 'completed block shows');
    // Add another round stays available past prescription and reopens the activity.
    document.querySelector('[aria-label="Edit completed Garage circuit"]').click();
    await until(() => document.querySelector('.activity-card'), 'completed activity reopens for editing');
    assert.equal(document.querySelector('.stepper-rounds-count').textContent, '2 rounds done', 'counter kept after completion');
    button('Add another round').click();
    await until(async () => (await storedActivity(storage)).segments.length === 9, 'extra round appended from the pattern');
    const added = await storedActivity(storage);
    assert.equal(added.completed, false, 'adding a round reopens the activity');
    assert.match(document.querySelector('.stepper-position').textContent, /Round 3 of 3/, 'extra round becomes current');
    assert.deepEqual(added.segments.slice(6).map(s => s.label ?? s.kind), ['Push-ups x15', 'Goblet squat x12', 'rest'], 'extra round cloned from round 1');
    button('Done round').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'extra round beyond prescription completes too');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v111: circuit Done all rounds still completes with an Undo toast that reopens', async () => {
  const dom = environment();
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Done-all QC');
  workout.exercises = []; workout.cardio = [circuitActivity()]; workout.blockOrder = [{ type: 'activity', id: workout.cardio[0].id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Garage circuit');
    button('Done: all rounds').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'Done all rounds completes the activity');
    await until(() => button('Undo'), 'toast Undo appears');
    button('Undo').click();
    await until(() => document.querySelector('.stepper-position')?.textContent.includes('Round 1 of 2'), 'Undo restores round 1 as current');
    const saved = await storedActivity(storage);
    assert.equal(saved.completed, false, 'Undo reopens the activity');
    assert.equal(saved.segments[0].status, 'unknown', 'Undo restores the round');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v111: routine segment-free circuit rounds counter increments, decrements, persists, and survives completion', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Routine rounds QC');
  const circuit = makeCardio('circuit'); circuit.name = 'Garage circuit';
  circuit.intervals = 'Push-ups x15, Goblet squat x12, Rest 20 sec';
  workout.exercises = []; workout.cardio = [circuit]; workout.blockOrder = [{ type: 'activity', id: circuit.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Garage circuit');
    assert.match(document.querySelector('.activity-card').textContent, /What I did \/ rounds/, 'routine notes stay prominent');
    assert.equal(document.querySelector('.routine-rounds-count').textContent, '0 rounds done', 'counter starts at zero without the field');
    const minus = document.querySelector('[aria-label="Remove one round"]');
    assert.ok(minus && minus.disabled, 'minus disabled at zero');
    button('Done round').click();
    await until(async () => (await storedActivity(storage)).roundsDone === 1, 'first round stored');
    button('Done round').click();
    await until(async () => (await storedActivity(storage)).roundsDone === 2, 'second round stored');
    assert.equal(document.querySelector('.routine-rounds-count').textContent, '2 rounds done');
    document.querySelector('[aria-label="Remove one round"]').click();
    await until(async () => (await storedActivity(storage)).roundsDone === 1, 'minus removes one round');
    assert.equal(document.querySelector('.routine-rounds-count').textContent, '1 round done');
  } finally { root.unmount(); await wait(30); }
  // Fresh app start from storage: the count persists across reload.
  const root2 = await reopen();
  try {
    await openActivity(dom, 'Garage circuit');
    assert.equal(document.querySelector('.routine-rounds-count').textContent, '1 round done', 'count persists across reload');
    button('Done: Garage circuit').click();
    await until(async () => (await storedActivity(storage)).completed === true, 'routine activity completes');
    assert.equal((await storedActivity(storage)).roundsDone, 1, 'completing keeps the rounds count');
  } finally { root2.unmount(); await wait(30); dom.window.close(); }
});

function swimActivity() {
  const { makeCardio } = require('../app/domain/training-types.ts');
  const swim = makeCardio('swim'); swim.name = 'Pool swim';
  swim.segments = [
    seg('f1', 'other', 60, { label: 'Freestyle', plannedDistanceM: 50, groupId: 's', iteration: 1 }),
    seg('f2', 'other', 60, { label: 'Freestyle', plannedDistanceM: 50, groupId: 's', iteration: 1 }),
    seg('f3', 'other', 60, { label: 'Freestyle', plannedDistanceM: 50, groupId: 's', iteration: 2 }),
    seg('f4', 'other', 60, { label: 'Freestyle', plannedDistanceM: 50, groupId: 's', iteration: 2 }),
    seg('c1', 'other', null, { label: 'Cool-down', plannedDistanceM: 100 }),
  ];
  return swim;
}

test('v111: swim set rows are distinct title/status/action blocks, micro-counter gone, footer carries progress, repeat is one tap', async () => {
  const dom = environment();
  Object.defineProperty(dom.window, 'innerWidth', { value: 390, configurable: true });
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Swim QC');
  workout.exercises = []; workout.cardio = [swimActivity()]; workout.blockOrder = [{ type: 'activity', id: workout.cardio[0].id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Pool swim');
    button('Show all · 3 sets').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'swim show all opens');
    const unit = document.querySelector('.activity-stepper-unit');
    assert.ok(unit, 'set row is its own block');
    const title = unit.querySelector('.stepper-unit-title');
    const status = unit.querySelector('.stepper-unit-status');
    const action = unit.querySelector('.stepper-done');
    assert.ok(title && status && action, 'title, status, and Done are distinct elements');
    assert.equal(title.textContent, 'Set 1 of 2', 'title holds only the set');
    assert.equal(action.textContent, 'Done: Set 1', 'action holds only its label');
    assert.notEqual(title, status, 'title and status are different nodes');
    assert.notEqual(title, action, 'title and action are different nodes');
    assert.doesNotMatch(document.querySelector('.activity-stepper').textContent, /parts done/, 'per-unit micro-counter is gone');
    assert.doesNotMatch(document.querySelector('.activity-stepper').textContent, /\d+ of \d+ parts/, 'no "N of M parts" anywhere in the stepper');
    const footer = document.querySelector('.activity-segment-group');
    assert.ok(footer, 'group footer renders');
    assert.match(footer.textContent, /Repeat group · 0 of 2 sets done · 0 of 4 intervals done/, 'footer carries set + interval progress');
    assert.ok(button('Done: rest of these sets', footer), 'footer done-rest is a plain button');
    assert.ok(button('Repeat this set', footer), 'footer repeat is a one-tap button');
    // The selection step is gone entirely.
    assert.equal(document.querySelector('.segment-repeat-select'), null, 'no pattern checkboxes');
    assert.doesNotMatch(document.querySelector('.activity-stepper').textContent, /Repeat selected pattern|Repeat count|Select one or more/, 'no selection-repeat chrome');
    // The set row's own Done still works, and one-tap repeat appends one set.
    action.click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Set 2 of 2'), 'set 2 becomes current');
    const footerAfter = document.querySelector('.activity-segment-group');
    button('Repeat this set', footerAfter).click();
    await until(async () => (await storedActivity(storage)).segments.length === 7, 'one more set appended');
    const saved = await storedActivity(storage);
    assert.deepEqual(saved.segments.slice(5).map(s => s.iteration), [3, 3], 'appended set is iteration 3');
    assert.match(cssRule('.activity-stepper-unit'), /display:\s*grid/, 'set rows are grid blocks, not inline runs');
    assert.match(cssRule('.activity-stepper-unit'), /gap:\s*8px/, 'set rows have a real gap');
    assert.match(cssRule('.activity-stepper-unit'), /padding:\s*10px/, 'set rows have real padding');
    assert.match(cssRule('.stepper-unit-row'), /gap:\s*12px/, 'title and action sit 12px apart');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v111: mobility session card is compact — one row per move, tighter padding', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Mobility QC');
  const mob = makeCardio('mobility'); mob.name = 'Morning mobility';
  mob.mobilityMoves = [
    { id: 'm1', name: 'Adductor rock-back', prescription: '2 × 8/side' },
    { id: 'm2', name: 'Calf stretch', prescription: '2 × 30 sec/side' },
    { id: 'm3', name: 'Hip opener', prescription: '2 × 8/side' },
  ];
  workout.exercises = []; workout.cardio = [mob]; workout.blockOrder = [{ type: 'activity', id: mob.id }];
  const { root } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Morning mobility');
    const rows = [...document.querySelectorAll('.mobility-list > div')];
    assert.equal(rows.length, 3, 'one row per move');
    for (const row of rows) {
      assert.equal(row.children.length, 2, 'move row is name + prescription on one row');
      assert.ok(row.querySelector('span'), 'name element');
      assert.ok(row.querySelector('strong'), 'prescription element');
    }
    assert.match(cssRule('.mobility-list > div'), /padding:\s*6px 10px/, 'move rows use compact padding');
    assert.equal(css().includes('.mobility-list > div { grid-template-columns: minmax(0, 1fr); }'), false, 'moves no longer stack to two lines on phones');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v111: effort completed state is a leading check + plan text + plain Done, same button, 44px target', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const { makeActivityEffort } = require('../app/domain/activity-logging.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Effort QC');
  const force = makeCardio('force'); force.name = 'Sled Push and Pull Drag';
  force.efforts = Array.from({ length: 2 }, () => {
    const effort = makeActivityEffort();
    effort.plannedDistanceM = 20; effort.plannedDurationSec = 60; effort.plannedLoad = 90;
    return effort;
  });
  workout.exercises = []; workout.cardio = [force]; workout.blockOrder = [{ type: 'activity', id: force.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Sled Push and Pull Drag');
    const rows = [...document.querySelectorAll('.activity-effort')];
    assert.equal(rows.length, 2, 'two effort rows');
    const first = rows[0];
    assert.equal(first.querySelector('.activity-effort-state').textContent.trim(), '1', 'leading slot shows the number before completion');
    assert.equal(first.querySelector('.activity-effort-plan-text').textContent, '20 m · 60 sec · 90 lb', 'plan is its own element, shown once');
    const done = [...first.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done');
    assert.ok(done, 'action slot is a plain Done button');
    assert.equal([...first.querySelectorAll('button')].filter(b => b.textContent.trim().startsWith('Done:')).length, 0, 'no "Done: <plan>" gluing anywhere in the row');
    assert.doesNotMatch(first.textContent, /Done:/, 'no glued Done text in the row');
    done.click();
    await until(async () => (await storedActivity(storage)).efforts[0].completed === true, 'first effort stored complete');
    assert.equal([...first.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done'), done, 'same button node after completing: no layout shift to a new control');
    assert.ok(first.querySelector('.activity-effort-state svg'), 'leading slot now carries the check');
    assert.equal(first.querySelector('.activity-effort-plan-text').textContent, '20 m · 60 sec · 90 lb', 'plan text unchanged by completion');
    assert.equal([...first.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done').textContent.trim(), 'Done', 'completed action still reads plain Done');
    assert.match(cssRule('.activity-effort-check'), /min-height:\s*44px/, 'Done keeps a 44px target');
    assert.ok(cssRule('.activity-effort-state'), 'leading state has its own rule');
    // Tapping Done on a completed effort undoes it.
    done.click();
    await until(async () => (await storedActivity(storage)).efforts[0].completed === false, 'Done on a completed effort undoes it');
    assert.equal(first.querySelector('.activity-effort-state').textContent.trim(), '1', 'leading slot back to the number');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
