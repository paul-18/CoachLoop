# v88 — Shell split and release QC

Based on published v87, commit f544cf0ab6f2155b57847ed811b1cdb38ac236d4.
All repository source files matched the baseline before editing.

## Changes

The entry file app/workout-app.tsx is reduced from 379 to 30 lines. Work is separated
by responsibility rather than moving the whole file into another large component:

| Module | Owns |
| --- | --- |
| shell/use-shell-model | Composes existing persistence and controllers; theme/update/restart coordination |
| shell/use-shell-navigation | Tab selection, return-to-top, calendar and Settings requests |
| shell/use-workout-controller | Start/save/repeat/replan, editor lifetime, finish/discard and history return |
| domain/workout-copy | Fresh IDs and prescription copies for repeat/replan |
| shell/use-progress-actions | Measurements, activity type, Progress preferences and load increments |
| shell/app-screens | Screen wiring and unchanged desktop/mobile tab layout |
| shell/app-dialogs | Import, coach, skip and HYROX dialog wiring |
| shell/workout-screen | Workout/HYROX editor wiring and save warning |
| shell/editor-gate, storage-status, view-error-boundary | Lease, loading/recovery and view error states |

One persistence hook still owns the log. No lazy imports were reintroduced, and
the IndexedDB schema, backup format, service worker and CSS are unchanged.
This improves maintainability. The downloaded bundle remains approximately the
same size (about 986 KB minified / 314 KB gzip), with the existing size warning.

The starter guide now disappears from ALL screens, including Settings, once a
workout is completed. New users keep the guide; Settings keeps it collapsed.

## Release QC

Run pnpm release:check locally or in CI. It runs TypeScript, lint, all tests,
production build, PWA generation and PWA checks in order, stopping on failure.
Reports/logs are rebuilt under ignored .release-checks/ for each run.
PR checks and Pages deployment use the same command. Both retain a report in
Actions artifacts for 14 days and add a readable table to the run summary.
The Pages publishing steps only run after successful checks.

New regression coverage:

- A 40-workout user never receives the Settings starter guide.
- Corrupt/newer-version backup rejection and Cancel leave the durable log intact.
- Merge retains newer profile/goals; repeated merge does not duplicate workouts.
- Complete restore replaces goals, profile, measurements, settings and workouts,
  retains the pre-restore checkpoint, exports correctly, and survives reopening.
- Real shell/Settings tests block updates during active training, prevent
  activation after a failed flush, and retain the log after a successful flush.
- Existing worker tests cover another open window, one intentional reload,
  offline repair, mixed-release rejection and previous-cache retention.
- Repeat/replan creates fresh records, leaves the original untouched, and does
  not count copied targets as performed volume.
- The release command is tested to stop before building after a failing test.

Final validation: 131 tests, TypeScript, lint, production build and PWA checks pass.
These are React DOM + isolated IndexedDB and simulated worker tests, not real
Safari/iPhone automation. Actual Files/share-sheet, safe-area and update testing
remain device QC tasks. No new live-site browser test was claimed for v88.
