const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, wait } = require("./helpers/dom-environment.cjs");
const { defaultState, makeWorkout, makeExercise, makeSet, makeCardio } = require("../app/domain/training-types.ts");

test('v118 UI: Mark incomplete on Set 3 clears "All work complete", and direct Unskip restores to pending', async () => {
  const dom = environment();
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const { prepareLoadedState } = require('../app/persistence/migrations.ts');

  const state = defaultState();
  const workout = makeWorkout('lb', 60, 'Squat day');
  workout.exercises = [makeExercise('lb', 60, 'Squat')];
  workout.exercises[0].sets = [
    makeSet('lb', { plannedWeight: 135, plannedReps: '5', actualWeight: 135, actualReps: '5' }),
    makeSet('lb', { plannedWeight: 185, plannedReps: '5', actualWeight: 185, actualReps: '5' }),
    makeSet('lb', { plannedWeight: 225, plannedReps: '5', actualWeight: 225, actualReps: '5' }),
  ];
  state.workouts = [workout];
  state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(prepareLoadedState(state));

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('.active-workout-card'), 'active workout card is rendered');
    document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-header'), 'workout editor opens');

    // Complete all 3 sets
    const checkButtons = () => [...document.querySelectorAll('button.set-check')];
    checkButtons()[0].click();
    await wait(30);
    checkButtons()[1].click();
    await wait(30);
    checkButtons()[2].click();
    await wait(40);

    // All sets complete -> exercise card is in reviewed state
    await until(() => document.querySelector('button.completed-block[aria-label*="Review Squat"]'), 'Squat is reviewed');
    
    // Open review to edit sets
    document.querySelector('button.completed-block[aria-label*="Review Squat"]').click();
    await until(() => document.querySelectorAll('button.set-check').length === 3, 'sets reopened in editor');

    // Mark Set 3 incomplete
    const set3Check = document.querySelector('button.set-check[aria-label="Mark Squat, Set 3 incomplete"]');
    assert.ok(set3Check, 'Set 3 has Mark incomplete aria-label');
    set3Check.click();
    await wait(40);

    // Verify header progress shows 2/3 sets
    const headerStatus = document.querySelector('.workout-header-title p');
    assert.ok(headerStatus && headerStatus.textContent.includes('2/3 sets'), 'Header displays 2/3 sets');

    // Verify rest bar does NOT read "All work complete"
    const restBar = document.querySelector('.rest-timer');
    if (restBar) {
      assert.ok(!restBar.textContent.includes('All work complete'), 'Rest timer must never say All work complete when open work exists');
    }

    // Now test Direct Unskip (D4)
    // Mark Set 1 skipped via dropdown menu
    const set1Trigger = document.querySelector('[aria-label*="Options for Squat, Set 1"]');
    assert.ok(set1Trigger, 'Set 1 options trigger is present');
    set1Trigger.focus();
    set1Trigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { button: 0, bubbles: true, ctrlKey: false }));
    await until(() => document.querySelector('[role="menuitem"]'), 'menu opened');
    const skipItem = [...document.querySelectorAll('[role="menuitem"]')].find(m => m.textContent.includes('Skip this set'));
    assert.ok(skipItem, 'Skip menu item present');
    skipItem.click();
    await wait(40);

    // Verify header shows skipped qualifier
    assert.ok(document.querySelector('.workout-header-title p').textContent.includes('1 skipped'), 'Header reflects skipped set');
    const cardProgress = document.querySelector('.exercise-card-progress');
    assert.ok(cardProgress && cardProgress.textContent.includes('1 skipped'), 'Card header reflects skipped set');

    // Verify set 1 has Unskip button
    const unskipBtn = document.querySelector('button.set-check[aria-label*="Unskip"]');
    assert.ok(unskipBtn, 'Set 1 check button now has Unskip aria-label');

    // Single tap on Unskip button directly restores to pending (not done)
    unskipBtn.click();
    await wait(40);

    // Verify set 1 is now pending (not complete, not skipped)
    const set1CheckAfter = document.querySelectorAll('button.set-check')[0];
    assert.equal(set1CheckAfter.getAttribute('aria-pressed'), 'false', 'Unskipped set returns directly to pending');
    assert.ok(set1CheckAfter.getAttribute('aria-label').includes('Complete'), 'Set 1 aria-label is back to Complete');

  } finally {
    root.unmount();
    await wait(30);
    dom.window.close();
  }
});

test('v118 UI: Station circuit renders scannable status helper text', async () => {
  const dom = environment();
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const { prepareLoadedState } = require('../app/persistence/migrations.ts');

  const state = defaultState();
  const workout = makeWorkout('lb', 60, 'Circuit day');
  workout.exercises = [];
  const circuit = makeCardio('circuit', 'Leg station circuit');
  circuit.segments = [
    { id: 's1', kind: 'other', plannedDurationSec: null, actualDurationSec: null, plannedDistanceM: null, actualDistanceM: null, status: 'unknown', label: 'Push-ups', groupId: 'r1', iteration: 1 },
    { id: 's2', kind: 'other', plannedDurationSec: null, actualDurationSec: null, plannedDistanceM: null, actualDistanceM: null, status: 'unknown', label: 'Air squats', groupId: 'r1', iteration: 1 },
  ];
  workout.cardio = [circuit];
  workout.blockOrder = [{ type: 'activity', id: circuit.id }];
  state.workouts = [workout];
  state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(prepareLoadedState(state));

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('.active-workout-card'), 'active workout card is rendered');
    document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-header'), 'workout editor opens');

    // Open the circuit activity card
    const circuitCollapsed = document.querySelector('[aria-label*="Leg station circuit"]');
    assert.ok(circuitCollapsed, 'Leg station circuit collapsed card exists');
    circuitCollapsed.click();
    await until(() => document.querySelector('.activity-card'), 'activity card opens');

    // Check helper text
    await until(() => document.querySelector('.stepper-rounds-helper'), 'stepper helper text is rendered');
    const helper = document.querySelector('.stepper-rounds-helper');
    assert.ok(helper.textContent.includes('Tap Mark complete when finished'), 'Explicit helper text guides athlete');

    // Check bottom action button says Mark complete
    const completeBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Mark complete'));
    assert.ok(completeBtn, 'Circuit card has explicit Mark complete button');
  } finally {
    root.unmount();
    await wait(30);
    dom.window.close();
  }
});

test('v119 UI: Segment-free circuit renders round count with correct singular/plural grammar and helper text', async () => {
  const dom = environment();
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const { prepareLoadedState } = require('../app/persistence/migrations.ts');

  const state = defaultState();
  const workout = makeWorkout('lb', 60, 'Garage circuit day');
  const circuit = makeCardio('circuit');
  circuit.name = 'Garage circuit';
  circuit.segments = []; // segment-free routine circuit
  circuit.roundsDone = 1;
  workout.cardio = [circuit];
  workout.blockOrder = [{ type: 'activity', id: circuit.id }];
  state.workouts = [workout];
  state.activeWorkoutId = workout.id;
  await storage.saveTrainingState(prepareLoadedState(state));

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('.active-workout-card'), 'active workout card is rendered');
    document.querySelector('.active-workout-card').click();
    await until(() => document.querySelector('.workout-header'), 'workout editor opens');

    // Open circuit card
    const card = document.querySelector('[aria-label*="Garage circuit"]');
    if (card) card.click();
    await until(() => document.querySelector('.routine-rounds-count'), 'routine rounds counter is rendered');

    // Grammar check: 1 round done (not 1 rounds done)
    const countText = document.querySelector('.routine-rounds-count').textContent;
    assert.equal(countText.trim(), '1 round done');

    // Helper text check: 1 round logged · Tap Mark complete when finished
    const helperText = document.querySelector('.routine-rounds-helper').textContent;
    assert.ok(helperText.includes('1 round logged · Tap Mark complete when finished'));
  } finally {
    root.unmount();
    await wait(30);
    dom.window.close();
  }
});

test('v119 UI: Primary tab switching while blank workout is open collapses into WORKOUT IN PROGRESS from fresh empty state', async () => {
  const dom = environment();
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const { prepareLoadedState } = require('../app/persistence/migrations.ts');

  const state = defaultState(); // completely empty pristine state
  await storage.saveTrainingState(prepareLoadedState(state));

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('.first-steps'), 'welcome screen is rendered');

    // Click "Start blank"
    const startBlankBtn = [...document.querySelectorAll('button')].find(b => b.textContent === 'Start blank');
    assert.ok(startBlankBtn, 'Start blank button is rendered');
    startBlankBtn.click();
    await wait(50);

    // Click "Blank workout Build as you train"
    await until(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Blank workout')), 'blank workout button available');
    const blankWorkoutBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Blank workout'));
    blankWorkoutBtn.click();

    // Verify workout editor is open
    await until(() => document.querySelector('.workout-header'), 'workout editor opens');

    // Click History tab in desktop rail or mobile nav
    const historyTab = [...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('History'));
    assert.ok(historyTab, 'History tab exists');
    historyTab.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
    historyTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, button: 0 }));
    await wait(50);

    // Verify History panel is now active
    await until(() => document.querySelector('#panel-history[data-state="active"]'), 'History tab opens');

    // Click Today tab
    const todayTab = [...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Today'));
    todayTab.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
    todayTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, button: 0 }));
    await wait(50);

    // Verify Today panel is active and shows "WORKOUT IN PROGRESS" card
    await until(() => document.querySelector('.active-workout-card'), 'Active workout card is visible');
    const activeCard = document.querySelector('.active-workout-card');
    assert.ok(activeCard.textContent.includes('WORKOUT IN PROGRESS') || activeCard.textContent.includes('Workout in progress'));
    assert.ok(activeCard.textContent.includes('Resume'));
  } finally {
    root.unmount();
    await wait(30);
    dom.window.close();
  }
});
