# Coach Loop v80 reliability update

This is a cumulative update for the existing GitHub Pages app. It retains the v80 name, ranked Coach goals, female/male coverage, Water polo and circuit activities, configurable shortcuts, Last 7 days cards, Progress sections and four accent presets.

## Changed

- All tab screens load with the app. Failed deferred screen imports can no longer leave a tab stuck at Opening view. Separate mobile/desktop tab IDs fix accessibility collisions. Screen and app error boundaries offer recovery/restart actions.
- The worker now awaits cache lookups before falling back to network, repairs missing cached files online, uses fresh install requests, validates the entry shell, isolates caches by app path and retains one previous release for an open older page.
- Foreground update checks and Check updates expose waiting releases. Restart to update waits for durable saving, requires an idle app and rejects activation while another same-scope window is open. No forced reload on focus or during a workout.
- Offline readiness checks the currently active worker, not a waiting release. Existing /CoachLoop/ data and editor locks keep their original names; additional app paths get isolated names. No unsafe takeover of another window's writer lock.
- Backups reject unsupported versions, corrupt JSON, invalid timestamps, duplicate IDs, broken references and invalid numeric measurements. Restore is size-limited, previews existing-record and other-section changes, snapshots first and commits to storage before changing the UI.
- Explicit deleted-record recovery creates new IDs and keeps normal deletion protection. Benchmark attempt merges retain the newer correction. Restore/erase disable editing while committing; failed erase transactions roll back fully. Erase deliberately deletes both data and local recovery copies, with an explicit warning to back up first.
- Queued whole-log saves coalesce superseded writes. Save failures remain visible and retry on foreground. The startup recovery screen can export the original log if a migration checkpoint cannot be written. Persistence/quota diagnostics are visible in Settings.
- Share backup / Save to Files uses supported file sharing with download fallback; blob download URLs remain available long enough for Safari. Backup timestamps say requested rather than claiming a file was saved externally.
- CSV has consistent columns and a Warm-up flag, includes completed repeated-effort totals and keeps skipped/partial evidence correctly labeled. History and coach exports use recorded cardio, not its prescription; repeated efforts are not duplicated. Weekly intensity claims require actual recorded intensity.
- FITLOG rejects nonsensical reps, unknown explicit activity types and contradictory ruck loads; previews include warm-up and RPE/RIR. Undo is available for the most recent unstarted saved FITLOG plan in the current app session.
- Previous-set hints compare normalized units and matching load protocols, use workout dates and display RIR. Epley estimates are named, exclude warm-ups and high-rep sets, and singles use their exact recorded load. Weekly volume uses weight × reps labels.
- Calendar-dependent views refresh across midnight/foreground. Date formatting uses local calendar days. Corrupt optional preferences fail harmlessly. Coverage recognizes exercise aliases; theme borders follow the selected accent. Touch controls and chart hit areas are enlarged.
- Unused Next/Cloudflare/D1 build dependencies and API fetchers are removed. Local merge/conflict compatibility remains for existing backups; old IndexedDB stores remain so upgrades do not destroy existing data. Optional browser-agent editing tools were removed. The test runner no longer depends on a hard-coded pnpm internals path.

## Verification

A clean pnpm 11.25.0 frozen install succeeded with the supplied lockfile. TypeScript and lint pass; all 103 automated tests pass. Production build and the expanded offline/subpath/update-worker checks pass. Build output caches seven files; the eager JavaScript entry is about 310 KB gzip. The source/ZIP is checked for common credential patterns, and contains no personal backup or production database. This is not an audit of historical GitHub commits or repository settings.

## Intentional limits

- The exact original iPhone fault could not be proven without its device logs. The reproduced missing-cache bug and vulnerable lazy-screen loading path are both fixed and covered by regressions.
- Eager tab loading makes the initial JavaScript larger (about 311 KB gzip); the build warning is non-blocking. Full-log validation/cloning still costs work as history grows, although pending disk writes coalesce. A per-record storage redesign is deferred.
- Persistence is best-effort on iOS. Home Screen installation and a persistence request cannot guarantee protection from eviction; an external JSON backup remains essential.
- Erase is intentionally destructive. It does not secretly retain deleted data. Use a disposable browser for erase testing.
- Starting a saved plan schedules it for today; editing an old completed workout preserves its original date. This remains intentional.
- There are no URL-based tab routes; relative Vite paths and manifest scope work under /CoachLoop/. No speculative 404/router rewrite was added.
- No accounts, cloud synchronization, direct AI API calls, unsafe imported HTML, blind automatic reloads, extra tabs or analytics dashboards were added.
- Physical iPhone/Safari, screen-reader, huge-history and actual two-deployment update testing remain user QC tasks. Desktop DOM and worker simulations do not prove physical-device behavior.

See IPHONE-QC.md and UPDATE-INSTRUCTIONS.txt. The v79 notes describe earlier features. V80-UPDATE-NOTES.md describes the original customization release; this file supersedes its old verification counts.
