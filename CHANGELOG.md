# Changelog

Release-specific design notes and QC live under [`docs/releases/`](docs/README.md). This file is the short index; it does not replace those detailed records.

## v108 — phone layout fixes (follow-up build, same version stamp)

- Stepper layout rules added (v108 shipped the stepper classes with no CSS, so phones fell back to browser defaults): current-part card with plan on its own line and intensity on its own quiet line, visible progress dots, Show-all rows that don't collide, 44px Done buttons kept.
- Import preview: Category control full-width under the activity name, same position for every block, no truncation.
- Effort rows: plan shown once per row; completing an effort keeps the same button in the same place with the checkmark added in place.
- FITLOG v2 parser now rejects yoga blocks with SEGMENT lines ("Yoga is recorded after the session: use MODE|summary with DURATION and NOTES, not SEGMENT lines."); summary yoga unaffected; already-stored segmented yoga still renders rather than hiding data. Grappling, soccer, water polo unchanged.
- Backup "newer release" comparison now understands dotted versions (v108.1, v108.2), so the warning fires correctly across patch releases.
- See [v108 follow-up update notes](docs/releases/V108-FOLLOWUP-UPDATE-NOTES.md). Built from live main `8bfcdbb`.

## v108 — interaction foundation

- Interaction foundation (spec v2 §3): the segment table is replaced by a stepper — current card + "Part N of M" text + progress dots + Show all compact cards, labeled "Done: <plan>" actions, tap-part expansion for one part at a time, "Complete all remaining as prescribed" on the stepper, and Undo for every Done tap. "Edit detail" is deleted; Add part and Repeat pattern live in the Show-all footer.
- Post-session cards for yoga, grappling, soccer, and water polo (duration + visible notes + labeled Done) when no segments exist; any activity WITH segments always shows the stepper. Mobility is a session card (moves read-only + duration + visible notes + labeled Done); pose cards are deferred to v109.
- Slim effort rows for force: plan as text + labeled check + "Did different" behind a tap; prescription stays behind "Edit prescription".
- Import preview lists parts compactly (one line per part, one collapsed line per repeat group, labels shown) instead of a single segment count.
- Move up/down for exercises and activities, operating on blockOrder (never the arrays), disabled at the ends, with "Moved up"/"Moved down" toasts.
- Optional ActivitySegment.label end-to-end (model, tap-part edit, cards, preview, coach export, History) with |/newline rejection in the UI. No FITLOG v3 parser in v108: labels come from UI edits only; v1/v2 parsers untouched.
- Activity completion stays independent of parts completion: final part done does not complete the activity, all-skipped is not complete, adding a part to a completed activity reopens it. As-prescribed values stay labeled as prescribed, never presented as measured; modified-without-actual contributes nothing for the missing measure.
- Compat: old backups import unchanged; v108 labeled backups import in v105 verbatim (its activity schema is passthrough and its loader spreads whole activities — labels preserved opaquely, not stripped; v105 has no segment UI). Release bumped to v108; release-gate tests updated for the new stamp.
- See [v108 update notes](docs/releases/V108-UPDATE-NOTES.md). Published from main at `8bfcdbb` (release `6e64f64` + e2e fix); Pages run #63 passed and deployed.

## v107 — published

- Fixes the v106 analysis findings: Repeat no longer destroys pattern-row data; group taps mark typed actuals as Measured; mark-typed-complete leaves segmented activities unfinished while unknown parts remain; "Not fully recorded" reaches weekly cards, Progress/Review text, summaries, and CSV; coach export keeps detail fields for segmented sessions and groups repeat lines; History badge and run-only lines restored; plan review compares segment plans; repeat/replan reset segments; segment editor scoped away from efforts activities; finish review shows mismatch notes; phone-width segment touch targets.
- FITLOG v2 parser corrections: nested-repeat error, projected expansion cap, 24-hour clock cap, first-tag dispatch, sequential repeats, REPEAT before MODE, pre-pass TYPE validation, distinct v1/v2 fingerprints, mixed-error line attribution, and prefix-line warnings instead of silent strips. Import dialog and preview now surface v2.
- Default backups no longer store a quick-log list, restoring v105 import compatibility; Restore-defaults and undo-blank-start leave it unset. Explicitly ticking walk in Settings still stores it by choice.
- See [v107 update notes](docs/releases/V107-UPDATE-NOTES.md) and [v107 QC](docs/releases/V107-QC.md). Published from `main` at `d20e6bb7c28e96d395541dbdf2cc3f649e68ee1b` (v107 release `c4511c5` plus a CI test-import fix); GitHub Pages workflow run #60 passed and deployed.

## v106 — release candidate

- Adds release stamps to backup exports, a one-time restore acknowledgment for backups from a numerically newer release, and validation passthrough for future movement and effort fields. Legacy skipped cardio is excluded from completed training evidence.
- Adds optional segmented cardio logging, per-part completion and measured-result rules, run/walk-specific totals, repeat groups, a quick-log detail editor, and the strict FITLOG v2 parser. FITLOG v1 remains supported.
- See [v106 update notes](docs/releases/V106-UPDATE-NOTES.md) and [v106 QC](docs/releases/V106-QC.md). Deployment status will be recorded after the release gate and Pages workflow complete.

## v105 — published

- Finish review edits now stay on the candidate workout, and choosing to mark typed activity results complete does not alter the draft until Save. Cancelling the review discards that candidate cleanly.
- The unfinished-work detail list now uses the same open-activity rule as its count. A DOM regression covers cancel/retry, session effort and notes retention, and a 10 km / 19 min warning requiring explicit confirmation.
- Saved-workout toast and Progress empty-state wording now match the action and control labels.
- Release records document the v104 upload recovery and the v104 second-review data-loss finding and correction.
- Published from `main` at `b8f169139f09e412872f65e70126197382c2c9ac`; GitHub Pages workflow run #56 passed and deployed.

## v104 — published

- Whole-rep validation now applies to strength estimates and volume, including legacy completed records with decimal reps.
- Unusual distance/time checks include entered effort results before completion, and the unconfirmed-results prompt proceeds through the standard finish review.
- The release gate adds a mobile-sized WebKit smoke check for bottom navigation, content clearance and repeated tab switching.
- PWA and Flutter projects carry matching shared training-rule fixtures for actual reps, completing prescriptions and lifting volume.
- README, license status and release guidance are clarified. Published to GitHub Pages from `main` at `6fb1537a0c9e575b09c2b07b08937afe52d510d1` after the release gate passed.

## v103

- Added warnings for implausible cardio distance/time pairs and a choice for entered results that were not marked complete.
- Rest timer Next advances past earlier unfinished blocks; warm-up labels start at W1 and working sets at Set 1.
- Clarified starter removal and the new-log quick-log defaults. Optimized handling of long FITLOG trailing separators.
- GitHub's `main` identifies itself as v103 at `c3c6002d58a674f41e5731d2b49fa7003b0fc6cf`.

## v102 and earlier

- [v102](docs/releases/V102-UPDATE-NOTES.md): activity plausibility warning, consistent completion counts, and first-run guidance.
- [v101](docs/releases/V101-UPDATE-NOTES.md): first-run demo/setup, completed counts, and quick-log defaults.
- Releases v94–v100 and earlier are indexed in the [release archive](docs/README.md).
