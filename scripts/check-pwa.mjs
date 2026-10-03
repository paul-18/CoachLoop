import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const dist=fileURLToPath(new URL("../dist/",import.meta.url));
const root=new URL("https://example.test/CoachLoop/");
const stores=new Map(),events={};let claimed=false,network=0,online=true,windows=1,skipped=false;
const cacheApi={
 async open(name){if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);return {
  async addAll(requests){for(const request of requests){assert.equal(request.cache,"reload");const url=new URL(request.url);assert.ok(url.href.startsWith(root.href));const relative=url.pathname.slice(root.pathname.length)||"index.html";await access(dist+relative);const type=relative.endsWith('.js')?'application/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.html')?'text/html':'application/octet-stream';entries.set(url.href,new Response(await readFile(dist+relative),{headers:{'content-type':type}}));}},
  async match(request){return entries.get(typeof request==='string'?request:request.url??request.href)?.clone();},
  async put(request,response){entries.set(request.url??request.href,response.clone());}
 };},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}
};
vm.runInNewContext(await readFile(dist+'sw.js','utf8'),{
 URL,Request,caches:cacheApi,
 async fetch(request){network++;if(!online)throw new TypeError('Offline');const relative=new URL(request.url).pathname.slice(root.pathname.length)||'index.html';return new Response(await readFile(dist+relative),{headers:{'content-type':relative.endsWith('.js')?'application/javascript':'text/html'}});},
 self:{registration:{scope:root.href},clients:{async claim(){claimed=true;},async matchAll(){return Array.from({length:windows},()=>({url:root.href}));}},async skipWaiting(){skipped=true;},addEventListener(type,fn){events[type]=fn;}}
});
const run=(name,event)=>new Promise((resolve,reject)=>events[name]({...event,waitUntil(p){p.then(resolve,reject);}}));
await run('install');const current=[...stores.keys()][0];const prefix=current.slice(0,current.lastIndexOf(':')+1);
// Current scope cleanup keeps one earlier release, unrelated apps and legacy caches.
stores.set(prefix+'older',new Map());stores.set(prefix+'previous',new Map());stores.set('coach-loop-pages:%2FOther%2F:release',new Map());stores.set('coach-loop-pages-legacy',new Map());
await run('activate');assert.ok(claimed);assert.ok(!stores.has(prefix+'older'));assert.ok(stores.has(prefix+'previous'));assert.ok(stores.has('coach-loop-pages:%2FOther%2F:release'));assert.ok(stores.has('coach-loop-pages-legacy'));
let readiness;await run('message',{data:{type:'COACH_LOOP_CHECK_OFFLINE'},ports:[{postMessage(v){readiness=v;}}]});assert.equal(readiness.ready,true);
const fetchResponse=async(url,mode='cors')=>{let response;events.fetch({request:{method:'GET',url,mode},respondWith(p){response=p;}});return await response;};
online=false;for(const url of stores.get(current).keys())assert.ok(await fetchResponse(url,url===root.href?'navigate':'cors'));assert.equal(network,0);
// Root and JavaScript misses must fetch online, reject offline, and never return undefined.
const entry=[...stores.get(current).keys()].find(url=>url.endsWith('.js'));const savedRoot=stores.get(current).get(root.href);stores.get(current).delete(root.href);
online=true;assert.ok(await fetchResponse(root.href,'navigate'));assert.equal(network,1);
online=false;await assert.rejects(fetchResponse(root.href,'navigate'),/Offline/);stores.get(current).set(root.href,savedRoot);
stores.get(current).delete(entry);online=true;const count=network;assert.ok(await fetchResponse(entry));assert.equal(network,count+1);assert.ok(stores.get(current).has(entry));
online=false;assert.ok(await fetchResponse(entry));
// A preceding release asset remains available during the controller/reload transition.
const old=root.href+'assets/old-hash.js';stores.get(prefix+'previous').set(old,new Response('old release'));assert.equal(await (await fetchResponse(old)).text(),'old release');
// Applying an update never takes over a second open app window.
let reply;windows=2;await run('message',{data:{type:'COACH_LOOP_APPLY_UPDATE'},ports:[{postMessage(v){reply=v;}}]});assert.equal(reply.applied,false);assert.equal(skipped,false);
windows=1;await run('message',{data:{type:'COACH_LOOP_APPLY_UPDATE'},ports:[{postMessage(v){reply=v;}}]});assert.equal(reply.applied,true);assert.equal(skipped,true);
const manifest=JSON.parse(await readFile(dist+'manifest.webmanifest','utf8'));assert.equal(new URL(manifest.start_url,root).href,root.href);assert.equal(new URL(manifest.scope,root).href,root.href);for(const icon of manifest.icons)await access(dist+new URL(icon.src,root).pathname.slice(root.pathname.length));
console.log(`PWA checks passed: ${stores.get(current).size} cached files, offline/missing-cache fallback, release retention, subpath and deliberate update safety.`);
