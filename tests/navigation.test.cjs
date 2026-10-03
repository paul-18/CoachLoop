/* Full DOM navigation regression; no browser network or personal log is used. */
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('all real tab screens open repeatedly with offline network state and unique tab IDs',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/CoachLoop/',pretendToBeVisual:true});
 const bind=new Set(['getComputedStyle','requestAnimationFrame','cancelAnimationFrame']);
 for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLDetailsElement','SVGElement','Node','MutationObserver','Event','CustomEvent','MouseEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])Object.defineProperty(globalThis,key,{value:bind.has(key)?dom.window[key].bind(dom.window):dom.window[key],configurable:true});
 Object.assign(globalThis,{indexedDB,IDBKeyRange,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,ResizeObserver:class{observe(){}disconnect(){}unobserve(){}}});
 window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};
 Object.defineProperty(navigator,'locks',{value:{request:async(_name,_options,callback)=>callback({})}});Object.defineProperty(navigator,'onLine',{value:false});
 const React=require('react'),{createRoot}=require('react-dom/client');const App=require('../app/workout-app.tsx').default;
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
  const settings=[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent==='Settings');settings.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(40);
  const before=[...document.querySelectorAll('[data-quick-log]')].map(e=>e.getAttribute('data-quick-log'));assert.equal(before.at(-1),'water_polo');
  document.querySelector('[aria-label="Move Water polo earlier"]').click();await wait(80);
  const after=[...document.querySelectorAll('[data-quick-log]')].map(e=>e.getAttribute('data-quick-log'));assert.equal(after.at(-2),'water_polo');assert.equal(after.at(-1),'yoga');
  const saved=await require('../app/persistence/training-storage.ts').loadTrainingState();assert.deepEqual(saved.settings.quickLogActivities.slice(-2),['water_polo','yoga']);
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,'no duplicate accessibility IDs');
 }finally{app.unmount();await wait(30);dom.window.close();}
});
