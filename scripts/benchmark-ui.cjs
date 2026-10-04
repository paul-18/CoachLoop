/* Isolated React DOM/fake IndexedDB timing. No layout, paint, VoiceOver or iPhone claims. */
const path = require('node:path'), fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { environment, until, tab, wait } = require('../tests/helpers/dom-environment.cjs');
const source = path.resolve('.'), output = process.argv[2];
async function run() {
  const dom = environment(), React = require('react'), { createRoot } = require('react-dom/client');
  const App = require(path.join(source, 'app/workout-app.tsx')).default;
  const storage = require(path.join(source, 'app/persistence/training-storage.ts'));
  const { syntheticHistory } = require('./qc-history-data.ts');
  const { makeWorkout, makeSet } = require(path.join(source, 'app/domain/training-types.ts'));
  const rows = [];
  for (const count of [100, 1000, 5000]) {
    sessionStorage.clear();
    const state = syntheticHistory(count), workout = makeWorkout('lb', 120, 'SYNTHETIC active benchmark');
    workout.exercises[0].name = 'Barbell Bench Press';
    workout.exercises[0].sets = [makeSet('lb', { actualReps: '6', actualWeight: 100, loadType: 'weighted' })];
    state.workouts.push(workout); state.activeWorkoutId = workout.id;
    await storage.saveTrainingState(state);
    const root = createRoot(document.getElementById('root'));
    try {
      let start = performance.now(); root.render(React.createElement(App));
      await until(() => document.querySelector('.active-workout-card'), 'Today ready');
      const coldOpenDomMs = performance.now() - start;
      start = performance.now(); tab('History'); await until(() => document.querySelector('.history-card'), 'History ready');
      const historyDomMs = performance.now() - start, historyCards = document.querySelectorAll('.history-card').length;
      const input = document.querySelector('[aria-label="Search workouts or exercises"]');
      start = performance.now();
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'SYNTHETIC QC 1 —');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await until(() => document.querySelectorAll('.history-card').length === 1, 'Search finds original history');
      const searchDomMs = performance.now() - start;
      start = performance.now(); tab('Progress'); await until(() => document.querySelector('h1')?.textContent === 'Progress', 'Progress ready');
      const progressDomMs = performance.now() - start;
      tab('Today'); await until(() => document.querySelector('.active-workout-card'), 'Today'); document.querySelector('.active-workout-card').click();
      await until(() => document.querySelector('.workout-shell'), 'Editor');
      const reps = document.getElementById(`reps-${workout.exercises[0].sets[0].id}`);
      start = performance.now();
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(reps, '9');
      reps.dispatchEvent(new Event('input', { bubbles: true }));
      const editDispatchMs = performance.now() - start;
      await until(async () => (await storage.loadTrainingState()).workouts.at(-1).exercises[0].sets[0].actualReps === '9', 'Latest edit saved');
      const editDurableMs = performance.now() - start;
      rows.push({ workouts: count, coldOpenDomMs, historyDomMs, historyCards, searchDomMs, progressDomMs, editDispatchMs, editDurableMs });
      console.log(JSON.stringify(rows.at(-1)));
    } catch (error) { console.error(document.body.textContent?.slice(0, 1500)); throw error; }
    finally { root.unmount(); await wait(30); }
  }
  dom.window.close();
  if (output) fs.writeFileSync(output, JSON.stringify({ environment: 'Node + jsdom + fake-indexeddb; DOM completion/polling timings, not browser paint or iPhone', rows }, null, 2) + '\n');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
