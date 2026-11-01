# Coach Loop v107 update notes

**Status:** published. v107 fixes the findings from the v106 analysis. No new features, no schema changes, no renames or deletions. Published from `main` at `d20e6bb7c28e96d395541dbdf2cc3f649e68ee1b` (v107 release `c4511c5` plus a CI test-import fix); GitHub Pages workflow run #60 passed and deployed. The live build's release digest matches the local production build exactly.

## What changed

- **Repeat no longer destroys pattern-row data.** Repeating a pattern that carries entered actuals or confirmed states is refused with a message telling the user to reset those rows to Not confirmed first. Clean patterns repeat exactly as before.
- **Group tap and unknown resolution respect typed actuals.** Tapping a repeat group (or resolving unknown parts) now marks a part with typed actuals as Measured (modified) instead of Completed, so totals use the entered result, not the plan. Parts without actuals still complete as prescribed. Skips are untouched, so 5-of-6 with a skipped 6th stays 5-of-6.
- **Mark-typed-complete is honest about unfinished parts.** Marking typed results complete on a segmented activity leaves the activity unfinished while unknown parts remain, so the History badge, CSV `record_status`, and plan review no longer claim completion early. The efforts branch already behaved this way.
- **"Not fully recorded" now reaches every totals consumer.** Weekly cards, Progress and Review text, workout summaries, and CSV cells carry the flag instead of a partial sum or a zero. A done part missing a measure still withholds that measure's total everywhere.
- **Coach export keeps the detail fields for segmented sessions.** Pace, average HR, elevation, ruck load, mobility movements, intervals, non-run effort, and notes are emitted alongside the segment block. Repeat groups collapse to one summary line followed by their parts, and rest parts show duration only. History rows do the same for rest parts.
- **History detail and badge fixed for segmented sessions.** Run-type segmented sessions show Running-only and Walking-only lines, mirroring coach export. A fully resolved segmented activity badges "As prescribed" or "Completed" instead of a parts count.
- **Plan review compares against segment plans.** When the summary plan is empty but segments carry plans, the comparison uses the segment plan sums, and an incomplete performed total renders "Not fully recorded" instead of "— min" / "— km".
- **Repeat and replan reset segments.** Repeated and replanned workouts get fresh segment ids, cleared actuals, and unknown status, with group and iteration preserved. Repeat promotes a modified part's actual result to its new plan, mirroring how completed sets promote performed values; replan keeps the original plan.
- **Segment editor scoping and finish-flow visibility.** The segment editor no longer renders for repeated-efforts activities (which already have their own editor). Add-segment defaults to run, walk, or other to match the activity instead of run for everything. The finish review now shows non-blocking segment-vs-summary mismatch notes, not just History.
- **Phone-width segment rows.** Segment inputs, selects, and buttons get a 44px minimum height and shrinkable widths at phone widths.
- **FITLOG v2 parser corrections.** A nested REPEAT now reports nesting instead of the generic repeat-content error. The expansion cap is checked against the projected total (pattern × count), so overshoot is caught at the offending line. Clock durations get the same 24-hour cap as unit durations. Dispatch uses only the first `[FITLOG:]` tag, so a v1 paste mentioning a v2 tag in prose is handled by v1's gate. Sequential repeat blocks are accepted and the instructions say so. REPEAT before its MODE line is accepted (missing or summary modes still fail in final checks). An invalid TYPE is rejected in the v2 pre-pass with v1's message. v2 and v1 pastes of the same workout now get different fingerprints. The mixed run/walk error blames the CARDIO line, not the MODE line. Prefix-like lines such as `MODEST|` are no longer silently stripped; they reach v1 and warn.
- **FITLOG v2 is discoverable.** The import dialog mentions both versions and segments, a "Load a segments example" button loads the golden run/walk block, the import preview shows segment count and planned minutes, and the v1 example's move form is corrected to `2 x 30 sec`.
- **v105 compatibility restored for default backups.** A fresh default backup no longer stores a quick-log list at all; the app falls back to the full default list (including walk) at runtime, so the file contains nothing v105's settings enum rejects. "Restore default shortcuts" and undo-blank-start also leave the list unset now. Onboarded users on the starter list (run, bike, circuit, yoga) were never affected. Explicitly ticking walk in Settings still stores it; that is the user's choice, and such a backup is still rejected by v105's enum, as before.

## Deliberately unchanged

- Done-subset totals are kept: a completed part's prescribed value is a confirmed value, so aggregates over done parts are legitimate and labelled where shown.
- One done part missing a measure still withholds that whole measure's total, per the spec's display rule.
- Typing into a segment's Actual field still resets the row to Not confirmed; edited values must be re-confirmed, and the finish flow's unconfirmed-actuals prompt catches leftovers. Undo-confirmation keeps typed actuals.
- Plausibility segment numbering, the circuit-name fallback, and inferred-value aggregation are unchanged.
- Out of scope, as authorized: the 5 open activity-logging decisions, carried v105 minors, move up/down one, zod hardening, and manifest copy drift.

## Data and compatibility

Evidence version is still 2. No stored field was renamed, repurposed, or deleted. Segments remain v105-safe: a segmented backup with the walk default removed imports in v105 with segments preserved verbatim. The three paths that used to store the walk default (pre-welcome default state, Restore default shortcuts, undo-blank-start) no longer store any list. Backups stamped v107 warn on older releases exactly as v106 stamps did, with numeric release comparison.

## iPhone PWA checks

Automated WebKit covers a phone-sized viewport, bottom navigation, tab switching, offline PWA assets, cache repair, and deliberate updates. It does not emulate installing or using the app on a physical iPhone. After deployment, check on the phone: Settings shows v107; segment rows at true phone width; backup restore end-to-end including a newer-stamped backup warning, acknowledged restore applying, and an unstamped backup with no warning; Repeat refused on a row with typed actuals; group tap on a typed-actual part shows Measured; coach export of a segmented session includes notes, pace, and HR; Progress run-only totals.
