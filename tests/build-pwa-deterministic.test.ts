import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

test("build-pwa produces byte-identical sw.js across two runs", { timeout: 180_000 }, () => {
  // The PWA script needs a built dist/; the gate runs Tests before the
  // Production build stage, so build it here when it is missing.
  if (!existsSync(join(dist, "index.html"))) {
    execFileSync(join(root, "node_modules/.bin/vite"), ["build"], { cwd: root, stdio: "pipe" });
  }
  execFileSync(process.execPath, ["scripts/build-pwa.mjs"], { cwd: root, stdio: "pipe" });
  const first = readFileSync(join(dist, "sw.js"), "utf8");
  execFileSync(process.execPath, ["scripts/build-pwa.mjs"], { cwd: root, stdio: "pipe" });
  const second = readFileSync(join(dist, "sw.js"), "utf8");
  assert.equal(first, second, "identical builds must produce identical sw.js");
  // The cache name carries a zero-padded release number, not a timestamp.
  const match = /const CACHE = PREFIX \+ "(\d{5}):" \+ "([0-9a-f]{20})";/.exec(first);
  assert.ok(match, "CACHE carries a version tag and digest");
  assert.equal(match[1], "00126");
  assert.equal(match[2].length, 20);
  // Version tags sort chronologically, so activate keeps the true previous release.
  assert.ok("coach-loop-pages:%2FCoachLoop%2F:00125:aaaaaaaaaaaaaaaaaaaa" < "coach-loop-pages:%2FCoachLoop%2F:00126:aaaaaaaaaaaaaaaaaaaa");
});
