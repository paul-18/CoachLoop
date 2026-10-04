# Coach Loop v85 — focused reliability release

Prepared from GitHub v84, commit `03662d113caaf36febf6d3d0e657a03427e5bd5d`.
Not live until you extract the overlay, commit the source and publish it.

## Fixed

- Finishing or discarding a merged unfinished workout selects another remaining session. Loading an older log with an orphaned active session repairs its pointer. The resume chooser also covers a single session with no pointer.
- Start, resume, finish and discard decisions live in `app/domain/workout-transitions.ts`, with regression tests independent of screen rendering. No broad app-shell rewrite or new state library.
- Error-screen downloads include readable raw data AND recovery checkpoints. Individual checkpoints can be restored normally on a working installation; a clearly labelled diagnostic bundle preserves everything readable. One failed read no longer prevents exporting the other data source.
- Missing offline files can be repaired online. SHA-256 checks ensure repaired files belong to that worker's release. New installations also verify all precached files, rejecting partial/mixed deployments. New-release HTML is never saved in an old worker's cache. Existing deliberate updates, multi-window protection and previous-release retention stay in place.
- Workout-header CSS retains responsive safe-area sizing; measured pixels affect only content/timer offsets. This removes the circular measurement that could freeze the first orientation's height.
- Coverage totals, source details and unmapped names use the same alias matching. Day-dependent totals and explanations recompute when the local date advances.
- Full JSON export and restore share a 50 MB limit, supporting backups above the former 10 MB cap. Export refuses an over-limit file with an explicit message instead of presenting an unrestorable file as a full backup. Split exports above 50 MB remain a future capability, not something claimed by this release.
- Settings explains Merge versus Complete restore correctly.
- Pull requests receive the same non-deploying typecheck/lint/test/build/PWA gates as publishing. Branch protection is not automatically enabled; configure it separately if you use PRs.

## Verification

- 123 tests passed, including real React DOM journeys for merged workouts, remount/resume, discard/new start, and damaged-log checkpoint downloads.
- TypeScript, ESLint, production build and service-worker checks passed.
- Service-worker checks cover missing HTML repair -> offline reuse, missing-icon repair, refusal to cache newer HTML, rejection of corrupt precache, preceding-release assets, GitHub subpaths and deliberate update/multiple-window safety.
- A valid synthetic 11 MB backup round-tripped; exports and imports above the agreed maximum reject clearly.
- A synthetic log of 1,000 workouts / 12,000 sets validated, exported (about 8.2 MB), restored and calculated successfully. On this environment, validation was about 250 ms, export 260 ms, restore 310 ms, and coverage/trends 165 ms. These are rough observations, NOT iPhone performance guarantees. Whole-log validation on frequent edits remains a future optimization if phone tests show typing latency.

## Kept unchanged

Eight themes, gold coverage scale, collapsed Coach goals, compact trend labels,
local-only storage, external AI chat workflow, timestamp rest timers and wake-lock
behavior. No accounts, cloud sync, new dependencies or automatic reloads.

## Limits and release checklist

Actual iPhone installed-PWA rotation, keyboard and download behavior are not
verified here. React DOM tests do not calculate browser layout. Use
[V85-IPHONE-QC.md](V85-IPHONE-QC.md) before considering the device check complete.

1. Automated checks green.
2. Restore an old synthetic backup and verify goals/profile/settings/results.
3. Test previous-version -> v85 update with existing synthetic history.
4. Test fresh install, installed iPhone portrait/landscape, background return and offline reopening.
5. Save a private real backup before updating the live log.

Rolling back website files does not reverse stored-data edits. Keep backups and
do not perform destructive QC on your only real log.
