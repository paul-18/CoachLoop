const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, tab, wait } = require('./helpers/dom-environment.cjs');
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const change = (dom, el, value) => { Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };

test('controlled Coach dialog returns focus; collapsed reviews defer work and failed copy exposes complete selectable text', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const { CoachDialog } = require('../app/views/today-view.tsx'), { MonthlyReview } = require('../app/views/training-review.tsx');
  const { defaultState } = require('../app/domain/training-types.ts');
  const state = defaultState(), root = createRoot(document.getElementById('root'));
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(React.Fragment, null,
      React.createElement('button', { onClick: () => setOpen(true) }, 'Open Coach'),
      React.createElement(CoachDialog, { open, onOpenChange: setOpen, state, onRemember() {}, onMarkSent() {} }),
      React.createElement(MonthlyReview, { state }));
  }
  try {
    root.render(React.createElement(Harness)); await until(() => button('Open Coach'), 'rendered');
    assert.equal(document.querySelector('.monthly-review-panel'), null, 'closed panel not calculated/mounted');
    const trigger = button('Open Coach'); trigger.focus(); trigger.click();
    await until(() => document.querySelector('[role="dialog"]'), 'Coach opens');
    button('Close').click(); await until(() => !document.querySelector('[role="dialog"]'), 'closed');
    await until(() => document.activeElement === trigger, 'focus restored to Coach opener');
    const details = document.querySelector('.monthly-review'); details.open = true; details.dispatchEvent(new Event('toggle'));
    await until(() => button('Copy'), 'review calculated on opening');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    document.execCommand = () => false;
    button('Copy').click(); await until(() => document.querySelector('textarea[readonly]'), 'manual copy shown');
    const text = document.querySelector('textarea[readonly]'); assert.match(text.value, /TRAINING REVIEW/); assert.match(text.value, /lb·reps/);
    text.focus(); assert.equal(text.selectionEnd, text.value.length); assert.equal(text.selectionStart, 0);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('duplicate FITLOG opens planned/completed/skipped/active copies in their existing views without importing another record', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState } = require('../app/domain/training-types.ts');
  const { parseFitlog } = require('../app/interchange/fitlog.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const fitlog = '[FITLOG:1]\nWORKOUT|Duplicate QC|2026-10-04\nEXERCISE|Bench\nSET|5|100 lb total\nREST|60\n[/FITLOG]';
  const state = defaultState(), planned = parseFitlog(fitlog, 'lb', {});
  const completed = parseFitlog(fitlog, 'lb', {}), skipped = parseFitlog(fitlog, 'lb', {}), active = parseFitlog(fitlog, 'lb', {});
  Object.assign(planned, { status: 'planned' });
  Object.assign(completed, { status: 'completed', completedAt: '2026-10-04T12:00:00Z', name: 'Completed duplicate' });
  Object.assign(skipped, { status: 'skipped', skippedAt: '2026-10-04T13:00:00Z', skipReason: 'QC skip', name: 'Skipped duplicate' });
  Object.assign(active, { status: 'active', startedAt: '2026-10-04T14:00:00Z', name: 'Active duplicate' });
  state.workouts = [planned, completed, skipped, active]; state.activeWorkoutId = active.id;
  await storage.saveTrainingState(require('../app/persistence/migrations.ts').prepareLoadedState(state));
  const before = JSON.stringify(await storage.loadTrainingState()), root = createRoot(document.getElementById('root'));
  async function review() {
    tab('Coach'); await until(() => button('Paste or save workout'), 'Coach import control'); button('Paste or save workout').click();
    await until(() => document.querySelector('[role="dialog"] textarea'), 'import opens');
    change(dom, document.querySelector('[role="dialog"] textarea'), fitlog); await wait(30);
    button('Review import').click(); await until(() => button('Open existing'), 'duplicate preview');
    assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Open existing').length, 4);
  }
  try {
    root.render(React.createElement(App)); await until(() => document.querySelector('[role="tab"]'), 'loaded');
    for (const [index, expected] of [[0, 'plan'], [1, 'completed'], [2, 'skipped'], [3, 'active']]) {
      await review(); [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Open existing')[index].click();
      if (expected === 'plan') {
        await until(() => document.querySelector('.plan-preview-dialog'), 'existing saved plan opens');
        button('Close').click(); await until(() => !document.querySelector('[role="dialog"]'), 'plan closed');
      } else if (expected === 'active') {
        await until(() => document.querySelector('.workout-shell'), 'existing active editor resumes');
        assert.match(document.querySelector('.workout-shell').textContent, /Active duplicate/);
      } else {
        await until(() => document.querySelector('.history-card .history-details') || document.querySelector('.history-card')?.textContent.includes('QC skip'), 'existing history shown');
        assert.match(document.querySelector('.history-card').parentElement.textContent, expected === 'completed' ? /Completed duplicate/ : /QC skip/);
      }
      assert.equal(JSON.stringify(await storage.loadTrainingState()), before, 'opening does not change saved log');
    }
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('exercise history remains reachable after deferral and renders 30-session batches', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const { ProgressView } = require('../app/views/progress-view.tsx'), { syntheticHistory } = require('../scripts/qc-history-data.ts');
  const state = syntheticHistory(65), root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(ProgressView, { state, onUpdateSettings() {}, onChangeActivityType() {}, onLogBodyweight() {}, onSaveWaist() {} }));
    await until(() => button('View exercise history'), 'history button available before calculating full history');
    button('View exercise history').click();
    await until(() => document.querySelector('[role="dialog"] section'), 'history opened');
    assert.equal(document.querySelectorAll('[role="dialog"] section').length, 30);
    button('Show 30 more sessions').click(); await until(() => document.querySelectorAll('[role="dialog"] section').length === 60, 'next batch');
    button('Show 30 more sessions').click(); await until(() => document.querySelectorAll('[role="dialog"] section').length === 65, 'last batch');
    assert.equal(button('Show 30 more sessions'), undefined);
    button('Close').click(); await until(() => !document.querySelector('[role="dialog"]'), 'history closed');
    button('View exercise history').click(); await until(() => document.querySelector('[role="dialog"] section'), 'history reopened');
    assert.equal(document.querySelectorAll('[role="dialog"] section').length, 30);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
