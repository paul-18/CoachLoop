const test = require('node:test'), assert = require('node:assert/strict');
const { environment, until, wait } = require('./helpers/dom-environment.cjs');

test('throwing updater retains immutable memory and durable state; a later edit still saves', async () => {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const { useTrainingPersistence } = require('../app/persistence/use-training-persistence.ts');
  const storage = require('../app/persistence/training-storage.ts');
  let owner;
  function Harness() { owner = useTrainingPersistence(); return React.createElement('p', null, owner.localSaveStatus); }
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(React.createElement(Harness));
    await until(() => owner?.ready && owner.localSaveStatus === 'saved', 'loaded');
    const previous = owner.state;
    assert.doesNotThrow(() => owner.setState(current => { current.goals.push('Unsafe mutation'); return current; }));
    assert.equal(owner.latestStateRef.current, previous);
    assert.deepEqual((await storage.loadTrainingState()).goals, previous.goals);
    owner.setState(current => ({ ...current, goals: ['Valid later edit'] }));
    await until(async () => (await storage.loadTrainingState()).goals[0] === 'Valid later edit', 'later edit saves');
  } finally { root.unmount(); await wait(30); dom.window.close(); }
});
