/* Real React DOM + isolated synthetic IndexedDB. This is not an iOS browser test. */
const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, tab, wait } = require("./helpers/dom-environment.cjs");

const button = (text, within = document) => [...within.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const change = (dom, el, value) => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };

async function openApp() {
  const dom = environment();
  const React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const storage = require('../app/persistence/training-storage.ts');
  const root = createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
  await until(() => document.querySelector('[role="tab"]'), 'app opens');
  if (button('Start blank')) { button('Start blank').click(); await until(() => !button('Start blank'), 'blank choice leaves the log empty'); }
  return { dom, root, storage };
}

test('v110: Coach view offers one v3 format copy and the new profile paragraph, no v1/v2 buttons', async () => {
  const { dom, root } = await openApp();
  try {
    tab('Coach'); await until(() => document.querySelector('.coach-format-disclosure'), 'Coach format disclosure renders');
    assert.ok(button('Copy format') || button('Copy v3 format'), 'single v3 format button');
    assert.ok(button('Copy profile paragraph') || button('Copy new profile paragraph'), 'profile paragraph button');
    assert.equal(button('Copy v1 format'), undefined, 'v1 copy button is gone');
    assert.equal(button('Copy v2 segments'), undefined, 'v2 copy button is gone');
    assert.match(document.querySelector('.fitlog-example').textContent, /\[FITLOG:3\]/, 'coach example is a v3 block');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});

test('v110: import dialog mentions v3 and a v3 block imports end to end with labels on preview and cards', async () => {
  const { dom, root, storage } = await openApp();
  const block = '[FITLOG:3]\nWORKOUT|V110 label check|2026-11-01\nCARDIO|Garage circuit\nTYPE|circuit\nMODE|segments\nDURATION|20\nREPEAT|4\nSEGMENT|other|||Push-ups x15\nSEGMENT|other|||Goblet squat x12\nSEGMENT|rest|20 sec||\nENDREPEAT\n[/FITLOG]';
  try {
    tab('Coach'); await until(() => button('Paste or save workout'), 'Coach import control');
    button('Paste or save workout').click();
    await until(() => document.querySelector('[role="dialog"] textarea'), 'import opens');
    const dialog = document.querySelector('[role="dialog"]');
    assert.match(dialog.textContent, /FITLOG/, 'dialog names the FITLOG block');
    change(dom, document.querySelector('[role="dialog"] textarea'), block); await wait(30);
    button('Review import').click();
    await until(() => document.querySelector('.import-preview-lines'), 'preview lines render');
    const preview = [...document.querySelectorAll('.import-preview-lines li')].map(li => li.textContent).join(' | ');
    assert.match(preview, /Repeat 4x \| Push-ups x15 \| Goblet squat x12 \| Rest 20 sec/, 'preview group rows carry station labels on separate lines');
    button('Start workout').click();
    await until(() => document.querySelector('.workout-shell'), 'active workout editor opens');
    const collapsed = document.querySelector('[aria-label="Edit Garage circuit"]') || document.querySelector('[aria-label="Log Garage circuit"]');
    assert.ok(collapsed, 'collapsed card for Garage circuit');
    collapsed.click();
    await until(() => document.querySelector('.grouped-activity-stepper'), 'grouped stepper renders for segmented circuit');
    assert.match(document.querySelector('.stepper-position').textContent, /Round 1 of 4/);
    assert.match(document.querySelector('.activity-stepper-current').textContent, /Push-ups x15/);
    assert.match(document.querySelector('.activity-stepper-current').textContent, /Goblet squat x12/);
    const saved = (await storage.loadTrainingState()).workouts.find(w => w.name === 'V110 label check');
    assert.deepEqual(saved.cardio[0].segments.slice(0, 3).map(s => s.label), ['Push-ups x15', 'Goblet squat x12', undefined]);
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
