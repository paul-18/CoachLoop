# v95 hybrid QC

Verified 2026-10-11 on the hybrid tree (v94 + this overlay), before packaging.

## Automated gate (release:check) — ALL GREEN

- TypeScript: clean.
- ESLint: clean.
- Tests: **185/185 pass** (was 174 in Grok's build with 1 failure; the stale
  first-use-guide integration test was rewritten for the new quick-setup
  flow, and 11 new structured-target tests were added).
- Production build: clean.
- PWA checks: passed (7 cached files, offline cache repair, mixed-release
  rejection, release retention, subpath and deliberate update safety).

## New behavior tests (tests/setup-content.test.ts)

- e1RM progress math without inventing evidence; target-reps normalization
  (225×5 vs 225×1).
- Retroactive completion stamped at creation; no false achievement.
- **Label-edit robustness**: renaming a target arbitrarily does not break
  tracking (the text-matching flaw in the earlier draft is gone).
- Reps targets (pull-ups), consistency targets (3×/week, 50 workouts),
  distance/race targets.
- oneThingToday ordering; PR message naming a reached target.
- **Persistence regression test**: goal targets survive the zod
  save/load boundary (the field-stripping bug class is covered); legacy
  states without the field still validate.
- mergeGoalTargets dedupes by preset; preset drafts show live progress.

## Integration test (tests/release-journeys.test.cjs)

- Fresh user sees Quick setup; skips and picks flow; picking Bench 225 and
  finishing saves one structured target with a stable id and sets
  setupComplete; setup disappears; target persists after remount; Coach tab
  shows it.

## iPhone checklist (for Paul on the beta)

1. Beta shows v95 after update.
2. Fresh install: Today shows Quick setup. Skip leaves no fake goals.
3. Pick Bench 225 → Continue → Skip for now: target appears in
   Settings → Training goals with a progress bar.
4. Rename the target's label (not possible in UI yet — skip).
5. Log a bench set: PR toast appears on a new estimated record.
6. Settings → Training goals → Concrete targets: drafts show live progress.
