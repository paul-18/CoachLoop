import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const root = new URL("https://example.test/CoachLoop/");
const stores = new Map();
const events = {};
let claimed = false;
const cacheApi = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async addAll(urls) {
        for (const url of urls) {
          assert.ok(url.href.startsWith(root.href), `Cache URL remains in the Pages subpath: ${url}`);
          const relative = url.pathname.slice(root.pathname.length) || "index.html";
          await access(dist + relative);
          entries.set(url.href, new Response(await readFile(dist + relative)));
        }
      },
      async match(request) { return entries.get(typeof request === "string" ? request : request.url ?? request.href)?.clone(); },
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
};
vm.runInNewContext(await readFile(dist + "sw.js", "utf8"), {
  URL, caches: cacheApi,
  fetch() { throw new Error("An offline cached request unexpectedly reached the network"); },
  self: { registration: { scope: root.href }, clients: { async claim() { claimed = true; } }, addEventListener(type, callback) { events[type] = callback; } },
});
await new Promise((resolve, reject) => events.install({ waitUntil(promise) { promise.then(resolve, reject); } }));
const current = [...stores.keys()][0];
stores.set("coach-loop-pages-old", new Map()); stores.set("another-app-cache", new Map());
await new Promise((resolve, reject) => events.activate({ waitUntil(promise) { promise.then(resolve, reject); } }));
assert.ok(claimed); assert.ok(!stores.has("coach-loop-pages-old")); assert.ok(stores.has("another-app-cache"));
let readiness;
await new Promise((resolve, reject) => events.message({ data: { type: "COACH_LOOP_CHECK_OFFLINE" }, ports: [{ postMessage(value) { readiness = value; } }], waitUntil(promise) { promise.then(resolve, reject); } }));
assert.equal(readiness.ready, true);
for (const url of stores.get(current).keys()) {
  let response;
  events.fetch({ request: { method: "GET", url, mode: url === root.href ? "navigate" : "cors" }, respondWith(promise) { response = promise; } });
  assert.ok(await response, `Offline response exists for ${url}`);
}
const manifest = JSON.parse(await readFile(dist + "manifest.webmanifest", "utf8"));
assert.equal(new URL(manifest.start_url, root).href, root.href);
assert.equal(new URL(manifest.scope, root).href, root.href);
for (const icon of manifest.icons) await access(dist + new URL(icon.src, root).pathname.slice(root.pathname.length));
console.log(`PWA checks passed: ${stores.get(current).size} files available offline under /CoachLoop/, including split views and icons.`);
