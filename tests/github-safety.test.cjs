/* CommonJS VM harness deliberately loads transpiled app modules and isolates browser mocks. */
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = require('node:path').resolve(__dirname, '..');
const req = createRequire(root + '/package.json');
const ts = req('typescript');
const assert = require('node:assert/strict');
const types = req(root + '/app/domain/training-types.ts');
const validation = req(root + '/app/persistence/training-validation.ts');
const migrations = req(root + '/app/persistence/migrations.ts');
const conflicts = req(root + '/app/persistence/field-conflicts.ts');
const parser = req(root + '/app/interchange/fitlog.ts');
const profile = req(root + '/app/domain/strength-profile.ts');
const test = require("node:test");
function hooks() {
  let cursor=0, cells=[], pending=[], dirty=false;
  const react={
    useState(initial) { const i=cursor++; if(!(i in cells)) cells[i]=typeof initial==='function'?initial():initial; return [cells[i], value=>{cells[i]=typeof value==='function'?value(cells[i]):value;dirty=true;}]; },
    useRef(value) { const i=cursor++; return cells[i]??(cells[i]={current:value}); },
    useMemo(fn,deps) { const i=cursor++; const old=cells[i]; if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j]))) cells[i]={value:fn(),deps}; return cells[i].value; },
    useCallback(fn,deps) { return react.useMemo(()=>fn,deps); },
    useEffect(fn,deps) { const i=cursor++; const old=cells[i]; if(!old||!deps||deps.some((d,j)=>!Object.is(d,old.deps[j]))) { cells[i]={deps,cleanup:old?.cleanup};pending.push(()=>{cells[i].cleanup?.();cells[i].cleanup=fn();}); } },
  };
  return {react, render(fn){cursor=0;dirty=false;return fn();}, effects(){const p=pending;pending=[];p.forEach(f=>f());}, get dirty(){return dirty;}};
}
function moduleUnderTest(relative,mocks={},extra='') {
  const filename=root+'/'+relative;
  const source=fs.readFileSync(filename,'utf8').replaceAll('import.meta.env?.PROD', 'true').replaceAll('import.meta.env.PROD', 'true').replaceAll('import.meta.env.BASE_URL', JSON.stringify('/CoachLoop/'))+extra;
  const code=ts.transpileModule(source,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const local=createRequire(filename);
  const module={exports:{}};
  const sandbox={module,exports:module.exports,require:id=>id in mocks?mocks[id]:local(id),console,structuredClone,window:global.window,navigator:global.navigator,document:global.document,setTimeout,clearTimeout,Date,Promise,process,AbortController,AbortSignal,MessageChannel,Response,fetch:global.fetch};
  vm.runInNewContext(code,sandbox,{filename});return module.exports;
}

test('decimal input commits null when cleared', () => {
  const h=hooks(), writes=[];
  const shared=moduleUnderTest('app/views/shared.tsx',{react:h.react,'@/components/ui/input':{Input:'input'}});
  const render=()=>h.render(()=>shared.DecimalInput({value:195,onValueChange:v=>writes.push(v)}));
  let tree=render();tree.props.onFocus({});tree.props.onChange({target:{value:''}});tree=render();tree.props.onBlur({});
  assert.deepEqual(writes,[null]);
});
test('focused decimal adopts an external update unless the athlete typed, and typing commits immediately', () => {
  const h=hooks(), writes=[];
  const shared=moduleUnderTest('app/views/shared.tsx',{react:h.react,'@/components/ui/input':{Input:'input'}});
  let current=185;
  const render=()=>{const tree=h.render(()=>shared.DecimalInput({value:current,onValueChange:v=>writes.push(v)}));h.effects();return tree;};
  let tree=render();tree.props.onFocus({});current=195;tree=render();assert.equal(tree.props.value,'185');
  tree=render();assert.equal(tree.props.value,'195');tree.props.onBlur({});assert.deepEqual(writes,[]);
  tree=render();tree.props.onFocus({});tree.props.onChange({target:{value:'205'}});assert.deepEqual(writes,[205]);
});
test('incomplete cardio never becomes completed summary data', () => {
  const shared=moduleUnderTest('app/views/shared.tsx',{'@/components/ui/input':{Input:'input'}});
  const w=types.makeWorkout('lb',120);w.exercises=[];w.status='completed';const a=types.makeCardio('run');a.actualDurationMin=12;w.cardio=[a];
  assert.doesNotMatch(shared.summarizeWorkout(w),/12 cardio min|completed activity/);
});
test('event dates and conflict values cannot produce an unloadable log', () => {
  const state=types.defaultState();state.scheduleContext.events.push({id:'qa',date:'',label:'Test'});assert.throws(()=>validation.validateSyncedState(state));
  state.scheduleContext.events=[];const w=types.makeWorkout('lb',120);state.workouts=[w];
  state.pendingConflicts=[{id:'qa',recordId:w.id,fieldPath:`/workouts/${w.id}/exercises/${w.exercises[0].id}/sets/${w.exercises[0].sets[0].id}/actualWeight`,base:100,remoteValue:110,raisingDeviceValue:120,raisingDeviceId:'qa',createdAt:new Date().toISOString()}];
  assert.throws(()=>conflicts.resolveFieldConflict(state,'qa','bad number'));
  assert.equal(conflicts.resolveFieldConflict(state,'qa',125).workouts[0].exercises[0].sets[0].actualWeight,125);
});
test('prototype paths are rejected at import and traversal boundaries', () => {
  for (const path of ['/__proto__/qa','/settings/constructor/prototype/qa','/settings/%5F%5Fproto%5F%5F/qa']) {
    const state=types.defaultState();state.pendingConflicts=[{id:'qa',recordId:'qa',fieldPath:path,base:null,remoteValue:1,raisingDeviceValue:2,raisingDeviceId:'qa',createdAt:'now'}];
    assert.throws(()=>migrations.prepareLoadedState(state));assert.equal(conflicts.writeConflictValue(state,path,'polluted'),false);assert.equal(({}).qa,undefined);
  }
});
test('FITLOG rejects huge loads before opening the editor', () => {
  assert.throws(()=>parser.parseFitlog('[FITLOG:1]\nWORKOUT|QA|2026-10-01\nEXERCISE|Bench press\nSET|1|100000000000000000000 lb|RPE 8\n[/FITLOG]','lb',{}),/5000/);
  assert.throws(()=>parser.parseFitlog('[FITLOG:1]\nWORKOUT|QA|2026-10-01\nEXERCISE|Bench press\nSET|1|185 lb|5\n[/FITLOG]'+' '.repeat(250_001),'lb',{}),/too large/);
});
test('completed child efforts survive exports and activity totals', () => {
  const history=req(root+'/app/interchange/history-export.ts'), coach=req(root+'/app/interchange/coach-export.ts'), workflow=req(root+'/app/domain/training-workflow.ts');
  const activity=req(root+'/app/domain/activity-logging.ts');
  const w=types.makeWorkout('lb',120);w.exercises=[];w.status='completed';const a=types.makeCardio('force');a.name='QA drag';a.loggingStyle='efforts';a.efforts=[{...activity.makeActivityEffort(),actualDistanceM:20,actualDurationSec:60,completed:true},{...activity.makeActivityEffort(),plannedDistanceM:999}];w.cardio=[a];const state={...types.defaultState(),workouts:[w]};
  assert.match(history.exportCompletedHistory(state),/20 m/);assert.match(coach.workoutToText(w),/Effort 1: 20 m/);assert.match(coach.workoutToText(w),/Effort 2: NOT COMPLETED/);
  assert.equal(workflow.activityTotals(workflow.activityRows(state)).distance,.02);assert.equal(workflow.activityTotals(workflow.activityRows(state)).minutes,1);
});
test('variants and unspecified pull-up protocols stay out of strength comparisons', () => {
  const state=types.defaultState(),w=types.makeWorkout('lb',120);w.status='completed';w.exercises[0].sets=[types.makeSet('lb',{loadType:'weighted',actualWeight:100,actualReps:'5',completed:true})];state.workouts=[w];
  for (const name of ['Kettlebell overhead press','Seated overhead press','Cable bench press','Assisted pull-ups','Kipping pull-ups']) {w.exercises[0].name=name;assert.equal(profile.strengthProfile(state,'lb').size,0);}
  w.exercises[0].name='Barbell overhead press';assert.ok(profile.strengthProfile(state,'lb').has('Overhead press'));
});
test('first offline installation stays checking until activation and then becomes ready', async () => {
  const h=hooks();let activate;
  const ready=new Promise(resolve=>activate=resolve);
  const listeners={};const registration={update:async()=>registration,waiting:null,active:null,installing:{state:'installing',addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){}};
  global.window={setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};
  global.document={readyState:'complete',visibilityState:'visible',addEventListener(){},removeEventListener(){}};
  Object.defineProperty(global,'navigator',{value:{serviceWorker:{register:async(url)=>{assert.equal(url,"/CoachLoop/sw.js");return registration;},ready,controller:null,addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){}}},configurable:true});
  const prior=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try {
    const module=moduleUnderTest('app/pwa/use-offline-status.ts',{react:h.react});let api;
    const render=()=>{api=h.render(()=>module.useOfflineStatus());h.effects();};render();await new Promise(setImmediate);render();assert.equal(api.offlineReady,'checking');
    registration.active={postMessage:(_message,ports)=>ports[0].postMessage({ready:true})};activate(registration);
    for(let i=0;i<10;i++){await new Promise(setImmediate);if(h.dirty)render();}
    assert.equal(api.offlineReady,'ready');
  } finally { if(prior===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=prior; }
});


function localEnvironment() {
  const listeners = {};
  global.window = {setTimeout, clearTimeout, addEventListener:(key, fn)=>listeners[key]=fn, removeEventListener(){}};
  global.document = {visibilityState:'visible', addEventListener:(key, fn)=>listeners[key]=fn, removeEventListener(){}};
  Object.defineProperty(global,'navigator',{value:{storage:{persist:async()=>true}},configurable:true});
  return listeners;
}
async function settle(h, render) {
  for (let i=0;i<6;i++) { await new Promise(setImmediate); if (h.dirty) render(); }
}

test('unreadable local storage opens recovery instead of writing an empty log', async () => {
  localEnvironment();const h=hooks();let writes=0;
  const loaded=moduleUnderTest('app/persistence/use-training-persistence.ts', {react:h.react,sonner:{toast:{error(){}}},'./training-storage':{
    loadTrainingState:async()=>{throw new Error('Storage unavailable');},saveTrainingState:async()=>writes++
  }});
  let api;const render=()=>{api=h.render(()=>loaded.useTrainingPersistence());h.effects();};
  render();await settle(h,render);
  assert.equal(api.ready,false);assert.equal(api.loadError,true);assert.equal(writes,0);
});

test('local edits reject invalid values, save latest evidence when hidden, and never sync', async () => {
  const listeners=localEnvironment();const h=hooks();const writes=[];let errors=0;
  const loaded=moduleUnderTest('app/persistence/use-training-persistence.ts', {react:h.react,sonner:{toast:{error(){errors++;}}},'./training-storage':{
    loadTrainingState:async()=>types.defaultState(),saveTrainingState:async(state)=>writes.push(structuredClone(state))
  }});
  let api;const render=()=>{api=h.render(()=>loaded.useTrainingPersistence());h.effects();};
  render();await settle(h,render);
  assert.equal(api.ready,true);
  api.setState(state=>({...state,settings:{...state.settings,barWeightLb:-5}}));render();await settle(h,render);
  assert.equal(api.state.settings.barWeightLb,45);assert.equal(errors,1);
  api.setState(state=>({...state,goals:['Keep my newest edit']}));
  // The background event may arrive before React's next render/save effect.
  global.document.visibilityState='hidden';listeners.visibilitychange();await new Promise(setImmediate);
  assert.deepEqual(writes.at(-1).goals,['Keep my newest edit']);
  assert.equal(api.lastSyncedAt,null);
});

test('failed local saves are visible and returning to foreground retries the latest state', async () => {
  const listeners=localEnvironment();const h=hooks();let fail=true;
  const loaded=moduleUnderTest('app/persistence/use-training-persistence.ts', {react:h.react,sonner:{toast:{error(){}}},'./training-storage':{
    loadTrainingState:async()=>types.defaultState(),saveTrainingState:async()=>{if(fail)throw new Error('Quota exceeded');}
  }});
  let api;const render=()=>{api=h.render(()=>loaded.useTrainingPersistence());h.effects();};
  render();await settle(h,render);assert.equal(api.localSaveStatus,'error');
  fail=false;listeners.focus();render();await settle(h,render);assert.equal(api.localSaveStatus,'saved');
});

test('failed restore leaves displayed and latest state unchanged', async () => {
  localEnvironment();const h=hooks();let rejectWrite=false;
  const loaded=moduleUnderTest('app/persistence/use-training-persistence.ts',{react:h.react,sonner:{toast:{error(){},success(){}}},'./training-storage':{loadTrainingState:async()=>types.defaultState(),saveTrainingState:async(state)=>{if(rejectWrite && state.goals.includes('Restored goal'))throw new Error('Storage full');},saveSnapshot:async()=>{}}});
  let api;const render=()=>{api=h.render(()=>loaded.useTrainingPersistence());h.effects();};render();await settle(h,render);
  const original=structuredClone(api.state),backup=types.defaultState();backup.goals=['Restored goal'];backup.goalsUpdatedAt='2026-10-03T12:00:00.000Z';
  // Pre-restore checkpoint succeeds; only the new state write fails.
  rejectWrite=false;
  rejectWrite=true;await assert.rejects(api.restoreBackup(backup),/Storage full/);render();
  assert.deepEqual(api.state,original);assert.deepEqual(api.latestStateRef.current,original);assert.equal(api.busy,false);
});

test('deliberate update saves first, rejects another window and reloads exactly once after activation', async () => {
  const h=hooks(), listeners=new Map();let commands=0,reloads=0,allow=false;
  const active={postMessage:(_msg,ports)=>ports[0].postMessage({ready:true,release:'current'})};
  const waiting={postMessage:(msg,ports)=>{if(msg.type==='COACH_LOOP_CHECK_OFFLINE'){ports[0].postMessage({ready:true,release:'new'});return;}commands++;ports[0].postMessage({applied:allow,reason:'Close another Coach Loop window'});if(allow)setTimeout(()=>{navigator.serviceWorker.controller=waiting;for(const fn of [...(listeners.get('controllerchange')??[])])fn();},5);}};
  const registration={active,waiting,update:async()=>{},addEventListener(){},removeEventListener(){}};
  global.window={location:{reload:()=>reloads++},addEventListener(){},removeEventListener(){}};
  global.document={readyState:'complete',visibilityState:'visible',addEventListener(){},removeEventListener(){}};
  Object.defineProperty(global,'navigator',{value:{onLine:false,serviceWorker:{controller:active,register:async()=>registration,ready:Promise.resolve(registration),addEventListener:(key,fn)=>listeners.set(key,[...(listeners.get(key)??[]),fn]),removeEventListener:(key,fn)=>listeners.set(key,(listeners.get(key)??[]).filter(f=>f!==fn))}},configurable:true});
  const module=moduleUnderTest('app/pwa/use-offline-status.ts',{react:h.react});let api;
  const render=()=>{api=h.render(()=>module.useOfflineStatus());h.effects();};render();
  for(let i=0;i<8;i++){await new Promise(setImmediate);if(h.dirty)render();}
  assert.equal(api.updateReady,true);assert.equal(api.offlineReady,'ready');assert.equal(api.release,'current');
  await assert.rejects(api.applyUpdate(async()=>{throw new Error('Save failed');},()=>true),/Save failed/);assert.equal(commands,0);assert.equal(reloads,0);
  await assert.rejects(api.applyUpdate(async()=>{},()=>true),/another Coach Loop window/);assert.equal(reloads,0);
  allow=true;let saved=false;await api.applyUpdate(async()=>{saved=true;},()=>true);assert.equal(saved,true);assert.equal(reloads,1);
  for(const fn of [...(listeners.get('controllerchange')??[])])fn();assert.equal(reloads,1);
});

test('complete restore commits before display replacement and preserves the pre-restore checkpoint', async () => {
  localEnvironment();const h=hooks(), checkpoints=[];let durable=types.defaultState(),rejectWrite=false;
  durable.goals=['Current'];durable.goalsUpdatedAt='2026-10-03T12:00:00.000Z';
  const loaded=moduleUnderTest('app/persistence/use-training-persistence.ts',{react:h.react,sonner:{toast:{error(){},success(){}}},'./training-storage':{loadTrainingState:async()=>durable,saveTrainingState:async(state)=>{if(rejectWrite && state.goals.includes('Backup'))throw new Error('Storage full');durable=structuredClone(state);},saveSnapshot:async(state)=>checkpoints.push(structuredClone(state))}});
  let api;const render=()=>{api=h.render(()=>loaded.useTrainingPersistence());h.effects();};render();await settle(h,render);
  const backup=types.defaultState();backup.goals=['Backup'];backup.goalsUpdatedAt='2026-09-01T12:00:00.000Z';
  rejectWrite=true;await assert.rejects(api.restoreBackup(backup,false,'replace'),/Storage full/);render();assert.deepEqual(api.state.goals,['Current']);assert.deepEqual(durable.goals,['Current']);
  rejectWrite=false;await api.restoreBackup(backup,false,'replace');render();assert.deepEqual(api.state.goals,['Backup']);assert.deepEqual(durable.goals,['Backup']);assert.deepEqual(checkpoints.at(-1).goals,['Current']);
});

test('restore commits the exact reviewed recovery IDs and refuses a stale preview', async () => {
  localEnvironment(); const h=hooks(); let durable=types.defaultState();
  const backup=types.defaultState(), workout=types.makeWorkout('lb',120,'Recover exact review');
  backup.workouts=[workout]; durable.deletedWorkoutIds=[workout.id];
  const loaded=moduleUnderTest('app/persistence/use-training-persistence.ts',{react:h.react,sonner:{toast:{error(){},success(){}}},'./training-storage':{loadTrainingState:async()=>durable,saveTrainingState:async(next)=>{durable=structuredClone(next);},saveSnapshot:async()=>{}}});
  let api; const render=()=>{api=h.render(()=>loaded.useTrainingPersistence());h.effects();};
  render(); await settle(h,render);
  const {reviewRestore}=req(root+'/app/persistence/backup-review.ts');
  const review=reviewRestore(api.state,backup,'merge',true).review;
  assert.ok(review); const id=review.next.workouts[0].id; assert.notEqual(id,workout.id);
  await api.restoreBackup(backup,true,'merge',review); await settle(h,render);
  assert.equal(durable.workouts[0].id,id,'commit must not regenerate a different recovery ID');
  const stale=reviewRestore(api.state,backup,'replace',false).review;
  api.setState(s=>({...s,goals:['Newer edit after review']})); render(); await settle(h,render);
  await assert.rejects(api.restoreBackup(backup,false,'replace',stale),/changed after preview/);
  assert.deepEqual(durable.goals,['Newer edit after review']);
});
