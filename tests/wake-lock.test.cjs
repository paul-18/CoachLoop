/* Wake Lock must never lock out permanently: after a dropped lock and failed
   re-acquires, returning to the app (visibilitychange / pageshow / focus)
   must try again. The v123 retries=0-on-success fix already broke the
   accumulation path; this pins the recovery behaviour. */
const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, wait } = require("./helpers/dom-environment.cjs");

test('wake lock re-acquires after release and failed retries on visibilitychange', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require('../app/workout-app.tsx').default;
  const { defaultState } = require('../app/domain/training-types.ts');
  const storage = require('../app/persistence/training-storage.ts');
  await storage.saveTrainingState(defaultState());
  let requestCalls = 0;
  const releaseListeners = [];
  let failNext = 0;
  const makeSentinel = () => {
    const sentinel = {
      released: false,
      release: async () => { sentinel.released = true; },
      addEventListener: (_type, fn) => { releaseListeners.push(fn); },
    };
    return sentinel;
  };
  Object.defineProperty(dom.window.navigator, 'wakeLock', {
    value: {
      request: async () => {
        requestCalls += 1;
        if (failNext > 0) { failNext -= 1; throw new Error('blocked'); }
        return makeSentinel();
      },
    },
    configurable: true,
  });
  const root = createRoot(document.getElementById('root'));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  try {
    root.render(React.createElement(App));
    await until(() => button('Start blank'), 'welcome opens');
    button('Start blank').click();
    await until(() => button('Blank workout'), 'today offers a blank workout');
    button('Blank workout').click();
    await until(() => document.querySelector('.workout-header'), 'workout editor opens');
    const toggle = document.querySelector('[aria-label="Keep screen awake"]');
    assert.ok(toggle, 'keep-awake toggle present');
    toggle.click();
    await until(() => requestCalls >= 1, 'wake lock requested once held');
    assert.equal(requestCalls, 1);
    // iOS drops the lock: fire the release listener, then fail the re-acquire.
    assert.equal(releaseListeners.length, 1);
    failNext = 1;
    releaseListeners[0]();
    // The 250 ms retry timer fires and fails; the catch schedules a bounded
    // re-attempt, but before it runs, returning to the app must retry now.
    await until(() => requestCalls >= 2, 'failed re-acquire was attempted');
    const beforeResume = requestCalls;
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
    await until(() => requestCalls > beforeResume, 'visibilitychange re-acquires after failures');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
