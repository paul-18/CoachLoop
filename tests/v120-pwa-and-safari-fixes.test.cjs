const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { environment, until, tab, wait } = require('./helpers/dom-environment.cjs');

test('A.1: Check updates surfaces up-to-date, update-ready, and failure outcomes in Settings', async () => {
  const dom = environment();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const offlinePath = require.resolve('../app/pwa/use-offline-status.ts');
  const previousModule = require.cache[offlinePath];
  let mode = 'up-to-date';
  require.cache[offlinePath] = {
    id: offlinePath,
    filename: offlinePath,
    loaded: true,
    exports: {
      useOfflineStatus: () => ({
        offlineReady: 'ready',
        updateReady: mode === 'update-ready',
        release: 'test-release',
        updateStatus: '',
        checkUpdates: async () => {
          if (mode === 'error') throw new Error('Network offline');
          return mode;
        },
        applyUpdate: async () => {},
      }),
    },
  };
  const App = require('../app/workout-app.tsx').default;
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'app opens');
    tab('Settings');
    const checkBtn = () => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Check updates');
    await until(() => checkBtn(), 'Check updates button rendered');

    mode = 'up-to-date';
    checkBtn().click();
    await until(() => document.body.textContent.includes("You're up to date"), 'shows up to date');

    mode = 'update-ready';
    checkBtn().click();
    await until(() => document.body.textContent.includes('Update downloaded — use Restart to update'), 'shows update downloaded');

    mode = 'error';
    checkBtn().click();
    await until(() => document.body.textContent.includes('Update check failed; try again while online.'), 'shows failure outcome');

    // Today version badge shows update indicator only when updateReady is true
    mode = 'up-to-date';
    tab('Today');
    await until(() => !document.querySelector('.today-version-update'), 'plain version when no update is ready');
    mode = 'update-ready';
    tab('Settings');
    await wait(30);
    tab('Today');
    await until(() => document.querySelector('.today-version-update'), 'compact update indicator shown on Today version badge');
    document.querySelector('.today-version-update').click();
    await until(() => document.querySelector('#panel-settings[data-state="active"]'), 'clicking Today version update badge opens Settings');
  } finally {
    root.unmount();
    await wait(30);
    dom.window.close();
    if (previousModule) require.cache[offlinePath] = previousModule;
    else delete require.cache[offlinePath];
  }
});

test('A.2 & B: skip link targets #main-content and fixed chrome re-anchors on focusout/pageshow', async () => {
  const dom = environment();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(App));
    await until(() => document.querySelector('[role="tab"]'), 'app opens');
    const skipLink = document.querySelector('a.skip-link');
    assert.ok(skipLink, 'skip link exists');
    assert.equal(skipLink.getAttribute('href'), '#main-content');
    assert.equal(skipLink.textContent, 'Skip to main content');
    const main = document.getElementById('main-content');
    assert.ok(main, '#main-content exists');
    assert.ok(main.classList.contains('app-main'));
    assert.equal(main.getAttribute('tabindex'), '-1');

    const nav = document.querySelector('.mobile-nav');
    assert.ok(nav, '.mobile-nav exists');
    document.dispatchEvent(new Event('focusout', { bubbles: true }));
    window.dispatchEvent(new Event('pageshow'));
    await wait(50);
    assert.equal(nav.style.transform, '', 'inline transform cleared after compositor re-anchor');

    const { Textarea } = require('../components/ui/textarea.tsx');
    const { Input } = require('../components/ui/input.tsx');
    const taEl = Textarea({});
    assert.equal(taEl.props.autoComplete, 'off');
    assert.equal(taEl.props.autoCorrect, 'on');
    assert.equal(taEl.props.autoCapitalize, 'sentences');
    assert.equal(taEl.props.spellCheck, true);
    assert.equal(taEl.props.name, 'workout-notes');
    const inEl = Input({ type: 'text' });
    assert.equal(inEl.props.autoComplete, 'off');
    assert.equal(inEl.props.autoCorrect, 'on');
    assert.equal(inEl.props.name, 'workout-entry');
  } finally {
    root.unmount();
    await wait(30);
    dom.window.close();
  }
});

test('A.3, A.4, A.5: manifest metadata, index.html meta tags, and multi-window refusal copy', async () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.lang, 'en');
  assert.equal(manifest.dir, 'ltr');
  assert.ok(Array.isArray(manifest.categories) && manifest.categories.includes('fitness'));
  assert.match(manifest.description, /AI chat/);
  assert.doesNotMatch(manifest.description, /ChatGPT/);
  assert.ok(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 2);
  assert.ok(manifest.screenshots.some(s => s.form_factor === 'narrow'));
  assert.ok(manifest.screenshots.some(s => s.form_factor === 'wide'));
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.some(s => s.name === 'Log workout') && manifest.shortcuts.some(s => s.name === 'History'));

  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes"\s*\/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"\s*\/>/);

  const css = fs.readFileSync(path.join(rootDir, 'app/globals.css'), 'utf8');
  assert.match(css, /\.skip-link\s*\{/);
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /\.mobile-nav,\s*\.workout-header,\s*\.rest-timer,\s*\.hyrox-controls\s*\{[^}]*translate3d\(0,0,0\)/);

  const { createUpdateCoordinator } = require('../app/pwa/update-coordinator.ts');
  let statusMsg = '';
  const fakeWorker = {
    postMessage(_msg, ports) {
      ports[0].postMessage({ applied: false });
    },
  };
  const coordinator = createUpdateCoordinator({
    workerEvents: new EventTarget(),
    pageEvents: new EventTarget(),
    waiting: () => fakeWorker,
    controller: () => fakeWorker,
    visible: () => true,
    reload: () => {},
    onStatus: (msg) => { statusMsg = msg; },
  });
  await assert.rejects(
    () => coordinator.apply(async () => {}, () => true),
    /Safari or the Home Screen app/
  );
  assert.match(statusMsg, /Safari or the Home Screen app/);
  coordinator.dispose();
});
