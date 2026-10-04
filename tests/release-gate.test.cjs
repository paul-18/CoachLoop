const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');

test('release command fails closed, keeps its report, and never builds after a test failure', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-loop-release-gate-'));
  try {
    for (const dir of ['app', 'scripts', 'tests', 'node_modules/typescript/bin', 'node_modules/eslint/bin', 'node_modules/vite/bin']) fs.mkdirSync(path.join(temp, dir), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../scripts/check-release.mjs'), path.join(temp, 'scripts/check-release.mjs'));
    fs.writeFileSync(path.join(temp, 'app/app-release.ts'), 'export const APP_RELEASE = "QC";');
    fs.writeFileSync(path.join(temp, 'node_modules/typescript/bin/tsc'), 'process.exit(0);');
    fs.writeFileSync(path.join(temp, 'node_modules/eslint/bin/eslint.js'), 'process.exit(0);');
    fs.writeFileSync(path.join(temp, 'node_modules/vite/bin/vite.js'), 'require("node:fs").writeFileSync("BUILD-SHOULD-NOT-RUN", "bad");');
    fs.symlinkSync(path.dirname(require.resolve('tsx/package.json')), path.join(temp, 'node_modules/tsx'));
    fs.writeFileSync(path.join(temp, 'tests/failed.test.cjs'), 'require("node:test")("deliberate QC failure", () => { throw new Error("stop release"); });');
    const env = { ...process.env, GITHUB_STEP_SUMMARY: '' };
    delete env.NODE_TEST_CONTEXT; // Run the nested gate as an independent command, not a test-worker child.
    const result = spawnSync(process.execPath, ['scripts/check-release.mjs'], { cwd: temp, encoding: 'utf8', env });
    assert.equal(result.status, 1);
    assert.equal(fs.existsSync(path.join(temp, 'BUILD-SHOULD-NOT-RUN')), false);
    const report = JSON.parse(fs.readFileSync(path.join(temp, '.release-checks/report.json'), 'utf8'));
    assert.equal(report.passed, false); assert.equal(report.results.at(-1).name, 'Tests');
    assert.match(fs.readFileSync(path.join(temp, '.release-checks/summary.md'), 'utf8'), /Production build \| Not run/);
    assert.match(fs.readFileSync(path.join(temp, '.release-checks/tests.log'), 'utf8'), /stop release/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
