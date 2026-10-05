const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, wait } = require('./helpers/dom-environment.cjs');

test('Coach clear persists empty check-in, preserves durable data and filters per-brief notes on reopen', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const { CoachDialog } = require('../app/views/today-view.tsx');
  const { useTrainingPersistence } = require('../app/persistence/use-training-persistence.ts');
  const { defaultState, localDate } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  const state = defaultState();
  state.goals = ['Keep my ranked goal']; state.coachProfile = 'Durable profile';
  state.settings.coachCheckIn = { date: localDate(), energy: '7', sleep: '6 hours', soreness: 'Legs', restrictions: 'No running', schedule: 'Morning PT' };
  await storage.saveTrainingState(state);
  let show, owner, copied = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
  function Harness() {
    owner = useTrainingPersistence(); const [open, setOpen] = React.useState(true); show = setOpen;
    return owner.ready ? React.createElement(CoachDialog, { open, onOpenChange: setOpen, state: owner.state, onMarkSent: () => {}, onRemember: checkIn => owner.setState(current => ({ ...current, settings: { ...current.settings, coachCheckIn: checkIn } })) }) : null;
  }
  const root = createRoot(document.getElementById('root'));
  const control = name => [...document.querySelectorAll('label')].find(label => label.firstChild?.textContent.trim() === name)?.querySelector('input,textarea');
  const change = (name, value) => { const el = control(name); assert.ok(el, name); const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const button = name => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === name);
  try {
    root.render(React.createElement(Harness)); await until(() => control('Energy (1–10)')?.value === '7', 'same-day check-in hydrated');
    change('Anything to emphasize?', 'Technique focus'); change('Time available', '45 min'); change('Equipment', 'Dumbbells'); change('What should your AI do?', 'Plan next session');
    await until(() => document.querySelector('pre')?.textContent.includes('Technique focus'), 'note in preview');
    button('Clear today’s fields').click();
    await until(() => control('Energy (1–10)')?.value === '' && owner.localSaveStatus === 'saved', 'clear saved');
    for (const name of ['Energy (1–10)', 'Soreness', 'Sleep last night', 'Restrictions', 'Mandatory PT / next 48 hours', 'Anything to emphasize?', 'Time available', 'Equipment', 'What should your AI do?']) assert.equal(control(name).value, '', name);
    const saved = await storage.loadTrainingState(); assert.equal(saved.settings.coachCheckIn.schedule, ''); assert.equal(saved.settings.coachCheckIn.energy, ''); assert.deepEqual(saved.goals, state.goals); assert.equal(saved.coachProfile, state.coachProfile); assert.deepEqual(saved.workouts, state.workouts);
    show(false); await wait(30); show(true); await until(() => control('Energy (1–10)'), 'reopened'); assert.equal(control('Energy (1–10)').value, '');
    change('Anything to emphasize?', 'Use case for this brief'); await until(() => document.querySelector('pre').textContent.includes('Use case for this brief'), 'new note preview');
    button('Copy full context').click(); await until(() => copied.includes('Use case for this brief') && !document.querySelector('[role="dialog"]'), 'copied and closed');
    assert.match(copied, /EVERY command on its own actual newline/);
    show(true); await until(() => control('Anything to emphasize?'), 'reopen after copy'); assert.equal(control('Anything to emphasize?').value, '');
    assert.ok(!(await storage.loadTrainingState()).coachProfile.includes('Use case for this brief'));
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
