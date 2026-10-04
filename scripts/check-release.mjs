import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const reportDir = path.join(root, ".release-checks");
rmSync(reportDir, { recursive: true, force: true }); // Reports belong to this run, never an earlier release.
mkdirSync(reportDir, { recursive: true });
const release = readFileSync(path.join(root, "app/app-release.ts"), "utf8").match(/APP_RELEASE\s*=\s*"([^"]+)"/)?.[1] ?? "unknown";
const tests = readdirSync(path.join(root, "tests")).filter(name => /\.test\.(ts|cjs)$/.test(name)).sort().map(name => `tests/${name}`);
const stages = [
  ["TypeScript", ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"]],
  ["Lint", ["node_modules/eslint/bin/eslint.js", ".", "--ignore-pattern", "dist", "--ignore-pattern", ".release-checks"]],
  ["Tests", ["--import", "tsx", "--test", ...tests]],
  ["Production build", ["node_modules/vite/bin/vite.js", "build"]],
  ["PWA generation", ["scripts/build-pwa.mjs"]],
  ["PWA behavior", ["scripts/check-pwa.mjs"]],
];
const results = [];
for (const [name, args] of stages) {
  console.log(`\nChecking ${name}…`);
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const output = (result.stdout ?? "") + (result.stderr ?? "") + (result.error ? `\n${result.error.message}` : "");
  process.stdout.write(output);
  writeFileSync(path.join(reportDir, `${name.toLowerCase().replaceAll(" ", "-")}.log`), output);
  results.push({ name, passed: !result.error && result.status === 0, exitCode: result.status, durationMs: Date.now() - started });
  if (!results.at(-1).passed) break;
}
const passed = results.length === stages.length && results.every(result => result.passed);
const report = { release, passed, node: process.version, results };
writeFileSync(path.join(reportDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
const summary = `## Coach Loop ${release} release checks\n\n${passed ? "Passed" : "Failed — publication must stop"}\n\n| Check | Result |\n| --- | --- |\n` + stages.map(([name]) => {
  const result = results.find(item => item.name === name);
  return `| ${name} | ${result ? result.passed ? "Pass" : "FAIL" : "Not run"} |`;
}).join("\n") + "\n\nIncludes React DOM journeys with isolated IndexedDB and simulated service workers. These checks do not certify Safari, iPhone safe areas, or actual Files/share-sheet behavior.\n";
writeFileSync(path.join(reportDir, "summary.md"), summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(`\n${passed ? "Release checks passed" : "Release checks failed"}; report: .release-checks/summary.md`);
process.exitCode = passed ? 0 : 1;
