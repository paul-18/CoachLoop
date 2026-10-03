/* Full DOM navigation regression; no browser network or personal log is used. */
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('all real tab screens open repeatedly with offline network state and unique tab IDs',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/CoachLoop/',pretendToBeVisual:true});
 const bind=new Set(['getComputedStyle','requestAnimationFrame','cancelAnimationFrame']);
 for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLDetailsElement','SVGElement','Node','NodeFilter','MutationObserver','Event','CustomEvent','MouseEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])Object.defineProperty(globalThis,key,{value:bind.has(key)?dom.window[key].bind(dom.window):dom.window[key],configurable:true});
 Object.assign(globalThis,{indexedDB,IDBKeyRange,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,ResizeObserver:class{observe(){}disconnect(){}unobserve(){}}});
 window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};
 Object.defineProperty(navigator,'locks',{value:{request:async(_name,_options,callback)=>callback({})}});Object.defineProperty(navigator,'onLine',{value:false});
 const React=require('react'),{createRoot}=require('react-dom/client');const App=require('../app/workout-app.tsx').default;
 const {defaultState,makeWorkout,localDate}=require('../app/domain/training-types.ts');
 const fixture=defaultState(),longExerciseName='Bench press with slow tempo and pauses '.repeat(8).trim(),workout=makeWorkout('lb',120);workout.date=localDate();workout.status='completed';workout.exercises[0].name=longExerciseName;workout.exercises[0].sets=workout.exercises[0].sets.slice(0,1);Object.assign(workout.exercises[0].sets[0],{completed:true,actualReps:'5',actualWeight:100,weightMode:'total',loadType:'weighted'});fixture.workouts=[workout];
 await require('../app/persistence/training-storage.ts').saveTrainingState(fixture);
 const app=createRoot(document.getElementById('root'));
 try{
  app.render(React.createElement(App));
  for(let i=0;i<100&&!document.querySelector('[role="tab"]');i++)await wait(20);
  assert.ok(document.querySelector('[role="tab"]'),'app opens');
  for(let round=0;round<3;round++)for(const name of ['History','Coach','Progress','Settings','Today']){
   const button=[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent===name);assert.ok(button,name);
   button.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));button.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}));
   await wait(40);assert.equal(button.getAttribute('aria-selected'),'true',name);assert.ok(document.querySelector('[role="tabpanel"][data-state="active"]'),`${name} content opens`);assert.equal(document.body.textContent.includes('Opening view…'),false);
   assert.equal([...document.querySelectorAll('button')].filter(b=>b.textContent==='Check updates').length,name==='Settings'?1:0,'update control belongs only in Settings');
  }
  const coach=[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent==='Coach');coach.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(40);
  const goals=document.querySelector('details.coach-goals');assert.ok(goals);assert.equal(goals.open,false,'goals start collapsed');goals.querySelector('summary').click();await wait(20);assert.equal(goals.open,true,'goals expand');goals.querySelector('summary').click();assert.equal(goals.open,false,'goals collapse');
  const progress=[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent==='Progress');progress.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(40);
  assert.equal(document.querySelectorAll('.anatomy-muscle.selected').length,0,'coverage starts with no muscle selected');
  assert.ok(document.body.textContent.includes('Tap a muscle to see its effective sets'));
  const chest=document.querySelector('.anatomy-muscle[aria-label="Show Chest coverage"]');assert.ok(chest);const originalFill=chest.getAttribute('fill');chest.dispatchEvent(new MouseEvent('click',{bubbles:true}));await wait(40);
  assert.equal(chest.getAttribute('fill'),originalFill,'selecting a muscle preserves its data colour');assert.equal(chest.getAttribute('aria-pressed'),'true');assert.ok(document.querySelector('.coverage-detail').textContent.includes('Chest'));
  const trendName=document.querySelector('.trend-series-name');assert.ok(trendName);assert.equal(trendName.textContent,longExerciseName);assert.equal(trendName.title,longExerciseName,'full name remains accessible');
  const historyButton=document.querySelector('.exercise-trend-history-button');assert.equal(historyButton.textContent,'View exercise history');assert.equal(historyButton.getAttribute('aria-label'),`View ${longExerciseName} history`);historyButton.click();await wait(60);assert.ok(document.querySelector('.exercise-history-title').textContent.includes(longExerciseName),'history retains the complete exercise name');
  const close=document.querySelector('[data-slot="dialog-close"]');assert.ok(close);close.click();await wait(60);
  const settings=[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent==='Settings');settings.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(40);
  const before=[...document.querySelectorAll('[data-quick-log]')].map(e=>e.getAttribute('data-quick-log'));assert.equal(before.at(-1),'water_polo');
  document.querySelector('[aria-label="Move Water polo earlier"]').click();await wait(80);
  const after=[...document.querySelectorAll('[data-quick-log]')].map(e=>e.getAttribute('data-quick-log'));assert.equal(after.at(-2),'water_polo');assert.equal(after.at(-1),'yoga');
  const saved=await require('../app/persistence/training-storage.ts').loadTrainingState();assert.deepEqual(saved.settings.quickLogActivities.slice(-2),['water_polo','yoga']);
  require('sonner').toast('Safe inset QC');await wait(60);
  const toaster=document.querySelector('[data-sonner-toaster]');assert.ok(toaster,'notification is rendered');
  assert.equal(toaster.style.getPropertyValue('--offset-top'),'calc(var(--app-safe-top, 0px) + 16px)');
  assert.equal(toaster.style.getPropertyValue('--mobile-offset-top'),'calc(var(--app-safe-top, 0px) + 16px)');
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,'no duplicate accessibility IDs');
  const today=[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent==='Today');today.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(40);
  const {IDBObjectStore}=require('fake-indexeddb'),put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(){throw new DOMException('QC write failure','QuotaExceededError');};
  try{
   const blank=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Blank workout'));assert.ok(blank);blank.click();
   for(let i=0;i<50&&!document.querySelector('[role="alert"]');i++)await wait(20);
   const warning=[...document.querySelectorAll('[role="alert"]')].find(e=>e.textContent.includes('Latest changes are not saved'));assert.ok(warning,'failed workout write displays its warning');
   assert.equal(warning.style.top,'calc(var(--app-safe-top, 0px) + 8px)');
   IDBObjectStore.prototype.put=put;warning.querySelector('button').click();
   for(let i=0;i<50&&document.body.textContent.includes('Latest changes are not saved');i++)await wait(20);
   assert.equal(document.body.textContent.includes('Latest changes are not saved'),false,'successful retry dismisses warning');
  }finally{IDBObjectStore.prototype.put=put;}

 }finally{app.unmount();await wait(30);dom.window.close();}
});
