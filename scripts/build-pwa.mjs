import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const walk = async (folder) => (await Promise.all((await readdir(folder, { withFileTypes: true })).map(async (entry) => {
  const path = join(folder, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
}))).flat();
const files = (await walk(dist)).filter((path) => !path.endsWith("/sw.js"));
const assets = files.map((path) => relative(dist, path).replaceAll("\\", "/")).filter((path) => path !== "index.html");
const digest = createHash("sha256");
for (const file of files) { digest.update(relative(dist, file)); digest.update(await readFile(file)); }
const cache = `coach-loop-pages-${digest.digest("hex").slice(0, 20)}`;
const worker = `const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(["./", ...assets.map((path) => `./${path}`)])};
const ROOT = new URL("./", self.registration.scope);
self.addEventListener("install", (event) => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS.map((path) => new URL(path, ROOT)));
})()));
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith("coach-loop-pages-") && name !== CACHE).map((name) => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener("message", (event) => {
  if (event.data?.type !== "COACH_LOOP_CHECK_OFFLINE") return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ready = (await Promise.all(ASSETS.map((path) => cache.match(new URL(path, ROOT))))).every(Boolean);
    event.ports[0]?.postMessage({ ready, release: CACHE });
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== ROOT.origin) return;
  const url = new URL(request.url);
  if (request.mode === "navigate" && (url.pathname === ROOT.pathname || url.pathname === ROOT.pathname + "index.html")) {
    event.respondWith((async () => (await caches.open(CACHE)).match(ROOT) ?? fetch(request))());
  } else if (ASSETS.some((path) => new URL(path, ROOT).href === url.href)) {
    event.respondWith((async () => (await caches.open(CACHE)).match(request) ?? fetch(request))());
  }
});`;
await writeFile(join(dist, "sw.js"), worker);
console.log(`Offline PWA ready: ${assets.length + 1} files cached`);
