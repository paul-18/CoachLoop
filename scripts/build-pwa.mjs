import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const walk = async folder => (await Promise.all((await readdir(folder, { withFileTypes: true })).map(async entry => {
  const path = join(folder, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
}))).flat();
const files = (await walk(dist)).filter(path => !path.endsWith("/sw.js"));
const assets = files.map(path => relative(dist, path).replaceAll("\\", "/")).filter(path => path !== "index.html");
const html = await readFile(join(dist, "index.html"), "utf8");
const entry = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
if (!entry) throw new Error("Build is missing its entry script");
const digest = createHash("sha256");
const assetHashes = {};
for (const file of files) {
  const bytes = await readFile(file);
  const path = relative(dist, file).replaceAll("\\", "/");
  digest.update(path); digest.update(bytes);
  assetHashes[path === "index.html" ? "./" : `./${path}`] = createHash("sha256").update(bytes).digest("hex");
}
digest.update(await readFile(fileURLToPath(import.meta.url)));
const release = digest.digest("hex").slice(0, 20);
const worker = `const ROOT = new URL("./", self.registration.scope);
const PREFIX = "coach-loop-pages:" + encodeURIComponent(ROOT.pathname) + ":";
const CACHE = PREFIX + ${JSON.stringify(release)};
const ASSETS = ${JSON.stringify(["./", ...assets.map(path => `./${path}`)])};
const HASHES = ${JSON.stringify(assetHashes)};
const ENTRY = ${JSON.stringify(entry)};
self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    await cache.addAll(ASSETS.map(path => new Request(new URL(path, ROOT), { cache: "reload" })));
    const shell = await cache.match(ROOT);
    if (!shell || !(await shell.text()).includes(ENTRY)) throw new Error("Release shell does not match its assets");
    for (const path of ASSETS) {
      const request = new Request(new URL(path, ROOT));
      const response = await cache.match(request);
      if (!response || !await responseMatchesRelease(request, response)) throw new Error("Release files do not match their expected hashes");
    }
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  const names = (await caches.keys()).filter(name => name.startsWith(PREFIX));
  // Retain one preceding release during the deliberate controller-swap/reload.
  const keep = new Set([CACHE, ...names.filter(name => name !== CACHE).slice(-1)]);
  await Promise.all(names.filter(name => !keep.has(name)).map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener("message", event => {
  if (event.data?.type === "COACH_LOOP_CHECK_OFFLINE") event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Repair only absent files from THIS release. An older worker must never
    // combine a newer document or same-name icons with its old hashed assets.
    if (event.data.repair === true) await Promise.all(ASSETS.map(async path => {
      const request = new Request(new URL(path, ROOT), { cache: "reload" });
      if (await cache.match(request)) return;
      try { await cacheCurrentResponse(cache, request, await fetch(request)); } catch { /* Offline, evicted or no longer hosted: leave readiness false. */ }
    }));
    const ready = (await Promise.all(ASSETS.map(path => cache.match(new URL(path, ROOT))))).every(Boolean);
    event.ports[0]?.postMessage({ ready, release: CACHE });
  })());
  if (event.data?.type === "COACH_LOOP_APPLY_UPDATE") event.waitUntil((async () => {
    const windows = (await self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .filter(client => new URL(client.url).pathname.startsWith(ROOT.pathname));
    if (windows.length > 1) { event.ports[0]?.postMessage({ applied: false, reason: "Close the other Coach Loop window before updating" }); return; }
    event.ports[0]?.postMessage({ applied: true });
    await self.skipWaiting();
  })());
});
async function responseMatchesRelease(request, response) {
  if (!response.ok) return false;
  const path = ASSETS.find(path => new URL(path, ROOT).href === request.url);
  if (!path) return false;
  const bytes = await response.clone().arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
  return hash === HASHES[path];
}
async function cacheCurrentResponse(cache, request, response) {
  if (!await responseMatchesRelease(request, response)) return false;
  await cache.put(request, response.clone());
  return true;
}
async function assetResponse(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const prior = (await caches.keys()).filter(name => name.startsWith(PREFIX) && name !== CACHE).reverse();
  for (const name of prior) { const response = await (await caches.open(name)).match(request); if (response) return response; }
  const response = await fetch(request);
  await cacheCurrentResponse(cache, request, response).catch(() => undefined);
  return response;
}
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== ROOT.origin) return;
  if (request.mode === "navigate" && (url.pathname === ROOT.pathname || url.pathname === ROOT.pathname + "index.html")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(ROOT);
      if (cached) return cached;
      const freshRequest = new Request(ROOT, { cache: "reload" });
      const response = await fetch(freshRequest);
      await cacheCurrentResponse(cache, freshRequest, response).catch(() => undefined);
      return response;
    })());
  } else if (url.pathname.startsWith(ROOT.pathname + "assets/") || ASSETS.some(path => new URL(path, ROOT).href === url.href)) {
    event.respondWith(assetResponse(request));
  }
});`;
await writeFile(join(dist, "sw.js"), worker);
console.log(`Offline PWA ready: ${assets.length + 1} files cached; release ${release}`);
