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

async function openActivity(dom, name) {
  const collapsed = document.querySelector(`[aria-label="Edit ${name}"]`) || document.querySelector(`[aria-label="Log ${name}"]`);
  assert.ok(collapsed, `collapsed card for ${name}`);
  collapsed.click();
  await until(() => document.querySelector('.activity-card'), 'activity card opens');
}

function makeWorkoutWith(state, workout, activity) {
  void state;
  workout.exercises = []; workout.cardio = [activity]; workout.blockOrder = [{ type: 'activity', id: activity.id }];
  return workout;
}

function circuitActivity() {
  const { makeCardio } = require('../app/domain/training-types.ts');
  const circuit = makeCardio('circuit'); circuit.name = 'Garage circuit';
  circuit.segments = [
    seg('p1', 'other', null, { label: 'Push-ups x15', groupId: 'g', iteration: 1 }),
    seg('s1', 'other', null, { label: 'Goblet squat x12', groupId: 'g', iteration: 1 }),
    seg('r1', 'rest', 20, { groupId: 'g', iteration: 1 }),
    seg('p2', 'other', null, { label: 'Push-ups x15', groupId: 'g', iteration: 2 }),
    seg('s2', 'other', null, { label: 'Goblet squat x12', groupId: 'g', iteration: 2 }),
    // Round 2's rest is pre-skipped: round Done must never auto-complete it.
    seg('r2', 'rest', 20, { groupId: 'g', iteration: 2, status: 'skipped' }),
  ];
  return circuit;
}

test('v109: circuit round stepper — Done Round 1 completes only round 1, skips untouched, round 2 becomes current', async () => {
  const dom = environment();
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Round QC');
  makeWorkoutWith(state, workout, circuitActivity());
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Garage circuit');
    assert.ok(document.querySelector('.grouped-activity-stepper'), 'grouped stepper renders for segmented circuit');
    assert.match(document.querySelector('.stepper-position').textContent, /Round 1 of 2/);
    assert.equal(document.querySelectorAll('.stepper-dot').length, 2, 'one dot per round, not per station');
    assert.ok(button('Done: Round 1'), 'labeled round Done on current card');
    assert.match(document.querySelector('.activity-stepper-current').textContent, /Push-ups x15/);
    assert.match(document.querySelector('.activity-stepper-current').textContent, /Goblet squat x12/);
    button('Done: Round 1').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Round 2 of 2'), 'current advances to round 2');
    await until(async () => (await storedActivity(storage)).segments[0].status === 'completed', 'round 1 station stored completed');
    const saved = await storedActivity(storage);
    assert.deepEqual(saved.segments.slice(0, 3).map(s => s.status), ['completed', 'completed', 'completed'], 'round 1 all done');
    assert.deepEqual(saved.segments.slice(3).map(s => s.status), ['unknown', 'unknown', 'skipped'], 'round 2 untouched, pre-skipped rest still skipped');
    assert.equal(saved.completed, false, 'finishing a round does not complete the activity');
    assert.equal(saved.segments[0].actualDurationSec, null, 'as-prescribed keeps actuals null');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v109: circuit Done all rounds completes every remaining round as prescribed', async () => {
  const dom = environment();
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'All rounds QC');
  makeWorkoutWith(state, workout, circuitActivity());
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Garage circuit');
    button('Done: all rounds').click();
    await until(async () => (await storedActivity(storage)).segments.filter(s => s.status === 'unknown').length === 0, 'no unknown parts remain');
    const saved = await storedActivity(storage);
    assert.deepEqual(saved.segments.map(s => s.status), ['completed', 'completed', 'completed', 'completed', 'completed', 'skipped'], 'all rounds done, skip untouched');
    assert.match(document.querySelector('.stepper-position').textContent, /All 2 rounds resolved/);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v109: circuit round Done undo via toast restores the round', async () => {
  const dom = environment();
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Round undo QC');
  makeWorkoutWith(state, workout, circuitActivity());
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Garage circuit');
    button('Done: Round 1').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Round 2 of 2'), 'round 1 done');
    await until(() => button('Undo'), 'toast Undo appears');
    button('Undo').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Round 1 of 2'), 'toast Undo restores round 1 as current');
    await until(async () => (await storedActivity(storage)).segments[0].status === 'unknown', 'round 1 station unknown again');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v109: circuit Show all lists rounds expandable to stations with tap-part expansion', async () => {
  const dom = environment();
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Round show-all QC');
  makeWorkoutWith(state, workout, circuitActivity());
  const { root } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Garage circuit');
    button('Show all · 0 of 6 parts done').click();
    await until(() => document.querySelector('.activity-stepper-list'), 'show all opens');
    const roundHeader = document.querySelector('[aria-label="Round 1 of 2: 0 of 3 parts done"]');
    assert.ok(roundHeader, 'round unit header in show all');
    roundHeader.click();
    await until(() => document.querySelector('.activity-stepper-unit-stations'), 'round expands to stations');
    assert.match(document.querySelector('.activity-stepper-unit-stations').textContent, /Push-ups x15/);
    // A station keeps tap-part expansion for actuals (duration/distance only).
    const station = [...document.querySelectorAll('.stepper-part-text')].find(b => b.textContent.includes('Push-ups x15'));
    assert.ok(station, 'station part text');
    station.click();
    await until(() => document.querySelector('.activity-stepper-expanded'), 'station expands to actual fields');
    assert.match(document.querySelector('.activity-stepper-expanded').textContent, /Actual sec/);
    assert.equal(document.querySelector('.activity-stepper-expanded').textContent.includes('reps'), false, 'no station reps field (prescription-and-completion only)');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
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

test('v109: swim interval stepper — set card, labeled set Done, then ungrouped interval card, then complete-all', async () => {
  const dom = environment();
  const { defaultState, makeWorkout } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Swim QC');
  makeWorkoutWith(state, workout, swimActivity());
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Pool swim');
    assert.ok(document.querySelector('.grouped-activity-stepper'), 'grouped stepper renders for segmented swim');
    assert.match(document.querySelector('.stepper-position').textContent, /Set 1 of 2/);
    assert.equal(document.querySelectorAll('.stepper-dot').length, 3, 'two sets + one ungrouped interval = three dots, never one per length');
    assert.ok(button('Done: Set 1'), 'labeled set Done');
    assert.match(document.querySelector('.activity-stepper-current').textContent, /Freestyle · 1 min · 50 m/);
    button('Done: Set 1').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Set 2 of 2'), 'set 2 becomes current');
    await until(async () => (await storedActivity(storage)).segments[0].status === 'completed', 'set 1 stored completed');
    button('Done: Set 2').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Interval 3 of 3'), 'ungrouped interval becomes current');
    assert.ok(button('Done: Cool-down · 100 m'), 'ungrouped interval gets a labeled plan Done');
    button('Done: all sets').click();
    await until(async () => (await storedActivity(storage)).segments.every(s => s.status === 'completed'), 'complete-all finishes the remaining interval as prescribed');
    const saved = await storedActivity(storage);
    assert.equal(saved.completed, false, 'finishing all intervals does not complete the activity');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v109: circuit/swim WITH segments render the grouped stepper; segment-free ones keep current views; AMRAP-shaped circuit stays summary + notes', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'View selection QC');
  const circuit = makeCardio('circuit'); circuit.name = 'Circuit plain';
  const swim = makeCardio('swim'); swim.name = 'Swim plain';
  const amrap = makeCardio('circuit'); amrap.name = 'AMRAP';
  amrap.intervals = 'AMRAP 20 min: burpees, kettlebell swings';
  workout.exercises = []; workout.cardio = [circuit, swim, amrap];
  workout.blockOrder = workout.cardio.map(a => ({ type: 'activity', id: a.id }));
  const { root } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Circuit plain');
    assert.equal(document.querySelector('.grouped-activity-stepper'), null, 'segment-free circuit has no stepper');
    assert.equal(document.querySelector('.activity-stepper'), null, 'segment-free circuit has no generic stepper either');
    assert.match(document.querySelector('.activity-card').textContent, /What I did \/ rounds/, 'segment-free circuit keeps routine notes');
    assert.ok(!button('Add parts'), 'no Add parts button for circuit');
    const collapse = button('Collapse');
    if (collapse) collapse.click();
    await openActivity(dom, 'Swim plain');
    assert.equal(document.querySelector('.activity-stepper'), null, 'segment-free swim has no stepper');
    assert.match(document.querySelector('.activity-card').textContent, /Minutes/, 'segment-free swim keeps summary basics');
    assert.ok(!button('Add parts'), 'no Add parts button for swim');
    const collapse2 = button('Collapse');
    if (collapse2) collapse2.click();
    await openActivity(dom, 'AMRAP');
    assert.equal(document.querySelector('.activity-stepper'), null, 'AMRAP-shaped segment-free circuit has no stepper');
    assert.match(document.querySelector('.activity-card').textContent, /AMRAP 20 min/, 'AMRAP instructions still shown');
    assert.match(document.querySelector('.activity-card').textContent, /What I did \/ rounds/, 'AMRAP keeps summary + notes');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v109 regression: run WITH segments still renders the generic v108 stepper, not the grouped one', async () => {
  const dom = environment();
  const { defaultState, makeWorkout, makeCardio } = require('../app/domain/training-types.ts');
  const state = defaultState(), workout = makeWorkout('lb', 60, 'Run regression QC');
  const run = makeCardio('run'); run.name = 'Run';
  run.segments = [seg('a', 'run', 240), seg('b', 'walk', 60), seg('c', 'run', 240)];
  workout.exercises = []; workout.cardio = [run]; workout.blockOrder = [{ type: 'activity', id: run.id }];
  const { root, storage } = await setup(dom, state, workout);
  try {
    await openActivity(dom, 'Run');
    assert.ok(document.querySelector('.activity-stepper'), 'generic stepper renders for run');
    assert.equal(document.querySelector('.grouped-activity-stepper'), null, 'run does not get the grouped stepper');
    assert.match(document.querySelector('.stepper-position').textContent, /Part 1 of 3/);
    button('Done: Run 4 min').click();
    await until(() => document.querySelector('.stepper-position').textContent.includes('Part 2 of 3'), 'generic stepper Done still advances');
    await until(async () => (await storedActivity(storage)).segments[0].status === 'completed', 'part stored completed');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
