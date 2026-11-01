# Coach Loop v106 update notes

**Status:** release candidate. v106 includes the Phase 0 safeguards and the specified Phase 1a/1b segment model, editor, and FITLOG v2 parser. This record will be updated with the published commit and deployment status after the release gate passes.

## What changed

- Backups include the writing release. Restore review asks for acknowledgment before importing a backup stamped with a numerically newer release. Legacy unstamped backups remain supported.
- Nested mobility and effort records retain unknown future fields. Legacy skipped cardio is excluded from completion and training totals even when an old completed flag is also set.
- Cardio can include optional run, walk, rest, or other segments. Each part stores its own plan, actual result, status, and optional repeat group/iteration. A plan counts as performed only after confirmation. Modified parts use entered actuals; skipped and unconfirmed parts do not count.
- Segmented duration and distance totals are withheld as “Not fully recorded” if any completed part lacks that measure. Running totals include run parts only; walking stays separate. History, Progress, finish review, plausibility warnings, and coach export use the segment evidence.
- The activity editor supports adding parts, entering planned/actual seconds and metres, confirming or skipping parts, undoing a confirmation, repeating a selected pattern 2–50 times, and completing only the remaining unknown parts in a repeat group. Quick-log opens directly into the chosen activity.
- FITLOG v2 adds strict `MODE`, `SEGMENT`, `REPEAT`, and `ENDREPEAT` parsing. Durations require units or `M:SS`; distances require `m` or `km`; repeats cannot nest and expand to at most 100 parts. Imported prescriptions start unconfirmed. FITLOG v1 remains supported.
- FITLOG v1 guidance, starter coach profile, and phone mobility wrapping were also updated.

## Data and compatibility

Segments are optional, so existing workouts and backups retain their existing shape. When segments exist they are authoritative for performed cardio totals; summary fields remain stored and are displayed alongside a warning if the confirmed duration differs by more than 30 seconds. The app does not reconcile or overwrite either value. A v105 reader does not know segment semantics, so use the v106 app to edit or re-export backups containing segments.

## iPhone PWA checks

Automated WebKit covers a phone-sized viewport, bottom navigation, tab switching, offline PWA assets, cache repair, and deliberate updates. It does not emulate installing or using the app on a physical iPhone. After deployment, check Settings shows v106 and confirm existing history, a quick-log activity, one repeated interval group, and a backup round-trip in iPhone Safari or the installed PWA.
