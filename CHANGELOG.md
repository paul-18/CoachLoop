# Changelog

Release-specific design notes and QC live under [`docs/releases/`](docs/README.md). This file is the short index; it does not replace those detailed records.

## v121 — published

- Prominent Session effort in Finish Workout dialog: moved Session effort out of the collapsed bottom disclosure to a highlighted `.finish-effort-card` at the very top of `.finish-review`, with one-tap RPE chips (`6 · Easy` through `10 · Max`), custom decimal input, and immediate persistence to the workout even if the user taps `Keep training`.
- Dialog close button ergonomics: kept the visual `X` icon compact (`size-4` / `16×16px`) while adding `-m-2 p-2` invisible hit padding.
- PWA & iOS Safari improvements: explicit "Check updates" outcome messages in Settings (`"You're up to date"`, `"Update downloaded — use Restart to update"`, or failure notice); compact `● v121 Update` pill on Today when a service-worker update is waiting; iOS Safari `.mobile-nav` compositor re-anchoring and keyboard auto-hide; iOS predictive-keyboard attributes (`autoComplete="off"`, `autoCorrect="on"`, `autoCapitalize="sentences"`, `spellCheck`, `data-form-type="other"`) preventing Contact Name autofill bars in notes; skip-to-content link; manifest metadata (`lang`, `dir`, `categories`, `screenshots`, `shortcuts`); Safari/Home Screen multi-window update guidance; and Rollup `manualChunks` bundle splitting.
- Workout editor, domain & history fixes: consistent working-set numbering after warm-ups (`W1, 1, 2`) in `HistoryView`, `planDifferences`, and `trainingCsvRows`; multi-activity `openActivityIds` state so opening a second activity no longer collapses the first; effort rest-timer `effort.id` tracking; weight-step reference set fallback to first uncompleted set; `substituteExercise` preservation of `plannedRpe`, `plannedRir`, and `unit`; `repeatWorkoutDraft` fallback to planned duration/distance and `replanWorkoutDraft` cleanup of import fingerprints, tombstones, and cardio performance stats; Undo tombstone cleanup for sets, exercises, and activities; Swim `GroupedActivityStepper` consistency; HYROX action-specific debounce; HYROX preview in `SavedPlanPreview`; and single-entry bodyweight grammar in `MonthlyReviewContent`.
- See [v121 update notes](docs/releases/V121-UPDATE-NOTES.md).

## v120 — published

- Fixed iOS Safari / Home Screen PWA native date-field overflow by disabling the problematic WebKit appearance sizing path, retaining the native `type=date` picker, restoring border-box width constraints, and reserving a line-height for the date value. Reset WebKit's internal date-edit padding. Added regression assertions and bumped `APP_RELEASE` to v120.
- See [v120 update notes](docs/releases/V120-UPDATE-NOTES.md).

## v119 — published

- **Post-release maintenance:** Removed automatic next-set reps focus after Done (the keyboard now opens only when validation focuses the current reps field for a rep-range confirmation); constrained all native date inputs and field labels to their parent width, including the workout-date dialog. Added regression checks. Version remains v119.

- Synchronized skipped-set count and qualifier: exercise card headers now mirror the workout header progress format (e.g. `2/2 sets · 1 skipped` or `0/2 sets · 1 skipped`) via `exerciseProgressCopy`, updating in lockstep across skips, unskips, additions, and removals.
- Segment-free circuit guidance & grammar: added `.routine-rounds-helper` copy (`X rounds logged · Tap Done / Mark complete when finished`) to clarify the finish workflow, and fixed singular/plural grammar across round counters and toasts (`1 round done` / `1 round logged`).
- Fractional minute rounding: applied `formatMeasure()` to planned duration and distance in plan differences, finish workout summary, and coach export, eliminating raw repeating IEEE-754 decimals (e.g. 40 sec planned interval displays cleanly as `0.67 min`).
- Progress honesty for unrecorded distances: omitted the `0 km` / `0 mi` prefix in Progress and weekly activity cards when distance was unrecorded, honestly displaying `1 session · 2 min · distance not fully recorded`.
- Root README FITLOG:3 alignment: corrected field order in root `README.md` to `WORKOUT|name|YYYY-MM-DD` with `MODE|summary` on run blocks, and added an automated parser test ensuring all fenced documentation examples pass validation with 0 errors and 0 warnings.
- Primary tab navigation hardening: clicking primary navigation tabs (Today, History, Coach, Progress, Settings) in either the desktop rail or mobile bottom bar while a workout editor is open cleanly collapses the active editor into the "WORKOUT IN PROGRESS" state on Today and immediately transitions to the chosen tab, identically in fresh empty profiles and populated logs.
- Honest QC reporting: updated release-gate reporting to accurately state: "All 7 release-check stages passed with zero test or ESLint failures/warnings (non-blocking Vite bundle-size notice only)".
- See [v119 update notes](docs/releases/V119-UPDATE-NOTES.md).

## v118 — published

- Counter honesty & undo synchronization: when any set, segment, or effort is undone ("Mark incomplete") or skipped, the status bar immediately recomputes to clear "All work complete" and cancels any active rest countdown timer, keeping header counters (e.g. 2/3 sets) and status bar 100% synchronized.
- Set count reconciliation: reconciled set denominator across workout header and exercise cards when sets are skipped, displaying explicit skipped qualifiers (e.g. `0/2 sets · 1 skipped` in header and `0 of 2 sets active (1 skipped)` on cards).
- Direct Unskip action: single-tap direct unskip restores skipped sets directly to pending (0 done) in both Review and set row menu without passing through a false "Done" state.
- Run quick-add minutes cleanup: interval duration input in running session builder uses neutral `—` placeholder and clears cleanly, preventing stale value reversion.
- Station circuit completion helper: scannable status text (`N rounds logged · Tap Mark complete when finished`) and an explicit `Mark complete` button clarify open-ended station circuit completion.
- Partial effort aggregation protection: `performedDuration()` and `performedDistance()` return null when any completed effort is missing its duration or distance measurement, guaranteeing partial sums never present as complete totals.
- Realistic numeric upper bounds: enforced validation limits on imported FITLOG values and stored state (load <= 5000, duration <= 10080 min, distance <= 1000 km, reps <= 5000, sets <= 500).
- Immediate exercise rename synchronization: renaming an exercise flushes synchronously to the active workout draft on change and blur, ensuring Today's "Next:" summary reflects the new title immediately.
- Compact mobile rest timer clearance: when rest countdown timer is active on screens <= 640px, header padding compacts and secondary subtitles collapse to preserve clean clearance beneath Dynamic Island.
- Modal backdrop dimming & nested stacking: dialog backdrops enhanced with `bg-black/80 backdrop-blur-sm` and child dialogs (`WorkoutDateDialog`) use `z-[60]` layering to prevent background chrome collision.
- Auto-close bodyweight modal: bodyweight logging dialog cleanly closes upon save.
- Tab navigation resilience & History click isolation: primary navigation tabs reliably switch views and gracefully collapse in-progress workout drafts to the Today card; `e.stopPropagation()` prevents clicks in History card details from bubbling.
- FITLOG v3 safe example & truncation diagnostic: updated safe import example to canonical `[FITLOG:3]` with `MODE|summary` and added targeted diagnostic errors when AI output cuts off before `[/FITLOG]`.
- Manual swim intervals & mobility shortcuts: enabled structured interval adding for manual Swim sessions and verified Mobility quick-log shortcut support.
- See [v118 update notes](docs/releases/V118-UPDATE-NOTES.md).

## v117 — published

- Mobile export date-filter layout fix: post-release hotfix (`fc760d6b`) containing the History export date-filter inputs within screen bounds on compact mobile viewports without horizontal shift.

- History export input alignment: eliminated the rightward offset of the `From` and `To` date rectangles in the export dialog. Formatted date inputs into a balanced 2-column mobile grid with block-level labels and native left-aligned date text (`[color-scheme:dark] text-left`), keeping `Exercise` spanning full width below.
- Import safe example refined: replaced duplicate example actions with a single "Load a safe example" action (removed "Load a segments example"). The sample now showcases Bench Press, Leg Press (demonstrating the new compact plate visualizer), an interval run (`4 x (3 min run / 1 min walk)` with pace and notes), and mobility.
- Subdued active interval button: softened `.stepper-done-current` font weight from extra-bold 800 to a clean semi-bold 650 with balanced text sizing (`.84rem`), preventing long interval names like `Done: tempo cruise 4 min 1 km` from standing out too aggressively.
- See [v117 update notes](docs/releases/V117-UPDATE-NOTES.md).

## v116 — published

- Rest interval options alignment & offset: eliminated the shifted/clipped left-offset popup when tapping the rest interval (e.g. `120s rest`) in strength exercises. Positioned `.exercise-options-row` relative to `CardHeader` spanning `left: 12px; right: 12px; width: auto; max-width: 400px;` so it stays fully inside the card and never clips text on iPhone screens.
- Dialog backdrop margins restored: changed `[role="dialog"] { max-width: 100vw; }` to `max-width: calc(100vw - 28px); margin-inline: auto;` so dialogs like Import Workout and Build Coach Brief show visible darkened background borders on both edges instead of stretching edge-to-edge.
- Three-dots menu collision safety: added `align="end" sideOffset={6} collisionPadding={16}` to strength, activity, history, and workout header three-dots menus, preventing them from extending off the right edge of the screen.
- Coach Dialog Close button overlap: added `pr-12` to `DialogHeader` and moved `Clear today's fields` into the dialog body directly above `Today's readiness & context`, preventing any collision with the top-right `X` close button.
- Leg Press plate visualizer: simplified plate loading display to render each unique plate denomination as a single disc badge with multiplication syntax (e.g. `[45 disc] × 8 360 lb total`) without long repetitive disc rows.
- See [v116 update notes](docs/releases/V116-UPDATE-NOTES.md).

## v115 — published

- Leg Press plate calculator: exercises matching Leg Press now display a plate breakdown calculated directly from total weight loaded (assuming 0 collar weight) using grouped multiplication syntax (e.g. `45 × 7 lb`, `45 × 6 + 25 lb`, and symmetric per-side counts when even).
- Import preview alignment & spacing: eliminated awkward nested margins (`.preview-nested`); styled repeat items with a lime border accent flush with card margins; placed the Category selector inline with activity titles to keep lower cards visible.
- Expanded Coach training ranges: added 2, 7, 14, 30, and 60 days to Quick update in Coach view, and added 2 and 60 days to training history options in Coach brief builder (for both existing and new chats).
- History export containment: locked horizontal overflow across `html`, `body`, and dialogs (`overflow-x: hidden; touch-action: pan-y`) so opening or viewing export text cannot shift or wobble the screen on iPhone.
- Compact Coach Brief Builder: condensed dialog headers, grouped readiness into a 2-column mobile grid, and reduced vertical height.
- See [v115 update notes](docs/releases/V115-UPDATE-NOTES.md).

## v114 — published

- iPhone 17 PWA & Dynamic Island: updated safe-area top fallback from 56px to 59px for iPhone 14 Pro/15/16 Pro/17 Dynamic Island dimension; added `-webkit-touch-callout: none` and `user-select: none` across workout cards and navigation to prevent accidental gym selection.
- Touch ergonomics: updated Discard button to 44px min touch target meeting Apple HIG requirements.
- Visual hierarchy: replaced nested borders on station rows and AMRAP items with subtle surface luminance shifts; eliminated duplicate inner round title on circuits.
- Distance on interval runs: interval-based runs/bikes/swims now show the Distance input beside Minutes to easily record total distance at session finish.
- See [v114 update notes](docs/releases/V114-UPDATE-NOTES.md).

## v113 — published

- Import preview (`previewSegmentRows`): repeat groups now render a `Repeat Nx` heading followed by each interval or station on its own separate dark card row.
- AMRAP & rounds stepper: routine circuit prescriptions (`12 min AMRAP: ...`) split into a heading and numbered exercise rows (`.amrap-plan`); routine and segmented circuit rounds counters use a single-row `[ - ] N rounds done [ ✓ ]` stepper.
- Compact activity cards: `Minutes` and `Activity options` / `More details` sit side-by-side on one row (`.activity-basics-row`) and expand full-width below when opened; Sled/Force efforts use inline icon buttons on a single row; activity `Done` buttons display `✓ Done · 12 min` visually while keeping the full name for screen readers.
- Focus auto-advance fix: completing a strength exercise or activity in a workout now automatically opens the next incomplete block even when the workout has only one strength exercise.
- Shorter Coach & Import copy: simplified the Paste FITLOG dialog description to one sentence and updated the visible `exampleFitlogV3()` block in Coach view to a clean strength + easy run example while keeping the full v3 spec on `Copy format`.
- See [v113 update notes](docs/releases/V113-UPDATE-NOTES.md).

## v112 — published

- Coach view `"Need the FITLOG format?"` fix: `.coach-quick-controls` wraps cleanly, `.coach-format-disclosure` prevents horizontal bleed, and `.fitlog-example` wraps long lines inside a dark code box so expanding the format guide never overflows iPhone screens. Remaining `"part"` wording in `FITLOG_V3_INSTRUCTIONS` replaced with `"interval"` / `"interval or station"`.
- Card visual consistency: Import preview segment/effort items, `.run-plan`, `.activity-instructions`, and `.activity-effort` rows now use dark card surfaces matching Strength sets instead of plain text or `.coach-cue` styling.
- Segmented circuits & swim: stations under `Round N of M` and intervals under `Set N of M` render on separate rows (`.stepper-unit-station-row`) instead of one run-on line; added `Undo round` alongside `Done round` in a compact `.stepper-rounds-bar`; tucked the per-round/per-station list into a collapsible `Rounds & stations (N rounds)` disclosure without duplicate per-station `Done:` buttons; suppressed duplicate routine-rounds counter when segments exist.
- Sled / Force (`efforts`): logging different numbers via `"Did different"` immediately updates the main top row text to show the performed weight/distance/reps while keeping `· prescribed ...` visible alongside it.
- Header collapse & focus flow: replaced the full-width top `Collapse` bar inside cards with a compact `<ChevronUp />` arrow button next to `...` in the card header; added one-block-at-a-time auto-advance and `"Collapse other blocks"` / `"Focus current block"` in the workout editor; styled routine `Undo round` as a button; enabled multi-line wrapping on `.activity-editor button` and `.stepper-done` so long activity names never clip.
- Simplified settings: removed the `Logging style` dropdown from `More details` (keeping `loggingStyle` in the data schema and `+ Add effort` on blank `force` blocks).
- Data & export fixes: `repeatWorkoutDraft` and `replanWorkoutDraft` reset `roundsDone`; `completion.ts`, `history-view.tsx`, and `coach-export.ts` include routine `roundsDone > 0`; `coach-export.ts` preserves activity-level prescribed duration for rep-based segmented circuits; `weekly-cards.ts` checks `flagMinutes` before displaying `0 min`; `fitlog.ts` strips whitespace-padded `REPEAT |` / `SEGMENT |` lines from `v1Body`.
- See [v112 update notes](docs/releases/V112-UPDATE-NOTES.md).

## v111 — published

- Plain-words sweep (Paul's v109 phone-test review: "Idk what parts mean"): every user-visible stepper string drops "part"/"parts". The generic stepper uses "Interval" ("Interval N of M", "Add interval", "Show all · N intervals", "All N intervals resolved"); circuits keep "Round", swim keeps "Set"; ungrouped circuit units show their station plan text; "Complete unknown parts" becomes "Done: rest of these rounds/sets/intervals" (plural, because the footer completes the whole group). Unlabeled "other" segments read "Interval" instead of "Part". Coach export and History keep the legacy "N of M parts done" count label — the sweep covers the steppers, not those views.
- Quick-add for manual logging: the generic stepper gains an inline row — Run / Walk / Rest / Other chips, one minutes field, one Add button. Add appends the interval and leaves the row ready, so "5 min run, 5 min walk, 4 min run" is three quick taps plus typing, with no form navigation and no per-interval save round-trip. "Add intervals" now opens the stepper on an empty list instead of inserting a blank interval, so chaining starts clean. Tapping an existing interval still expands it for inline duration/distance editing. Grouped steppers keep their Add button; quick-add there was judged not to fit without complicating the set/round cards, so generic stepper only.
- Circuit redesign: station lists are always visible — no Show-all hiding for circuits. One "Done round" action completes the current round's unknown stations; a rounds-done counter ("N rounds done") is always visible; reaching the prescribed round count completes the activity (its toast Undo reopens it); "Add another round" appends a cloned round from the pattern, so rounds are unlimited; "Done: all rounds" + Undo toast kept. Swim keeps its set-card flow — only the spacing fix below.
- Swim spacing fix: each set row is its own padded block (grid, 8px gap, 10px padding; title/status/action 12px apart), so title, status, and Done can never glue into "…doneDone: Set 1". The per-unit "N of M parts done" micro-counter is gone entirely; multi-segment progress lives in the group footer ("Repeat group · X of Y sets done · A of B segments done").
- Routine (segment-free) circuits: the "What I did / rounds" notes stay prominent, plus a rounds-done counter — "Done round" button, "N rounds done" display, a minus control to remove one, Undo toast. Storage is a new OPTIONAL `roundsDone` number on the activity: old-shape activities load fine without it, new-shape activities round-trip, older builds ignore it (activity schemas passthrough unknown fields), completing the activity keeps the count, and evidenceVersion is unchanged.
- Mobility density: same content, less space — move rows go from 10px/12px padding to 6px/10px with tighter gaps and smaller type, and moves no longer stack to two lines on phones (the narrow-screen single-column override is gone).
- Effort completed state: the check never glues onto the plan text. Each effort row is now a leading slot (number, or a check when done) + the plan as its own element + a plain "Done" action slot that reads "Done" in both states, so nothing shifts on completion; tapping Done on a completed effort undoes it. 44px targets kept. The grouped current card was checked too: its plan text and Done action were already separate elements, so it needed no change.
- Simpler stepper chrome: the default view shows only the current card + dots + Done + Show all (plus quick-add on the generic stepper, and the rounds counter / Done-all / station list on circuits). Repeat is a per-group one-tap button — "Repeat this round" / "Repeat this set" / "Repeat this interval" — acting on its own group directly; the selection step is gone entirely (no checkboxes, no "Repeat selected pattern xN", no "Repeat count (2–50)" input, no pattern helper text). Complete-all for generic/swim now lives behind Show all; circuit "Done: all rounds" stays visible.
- Small semantics unification: a round/set counts as done when nothing in it is unknown and at least one station was done — a round with a skipped rest is a finished round; an all-skipped round is skipped, not done. This keeps the circuit counter, the dots, and the group footers in agreement.
- Deliberate non-changes: no FITLOG v3 parser or prompt changes, no strength-logging changes, no totals/labels arithmetic changes, no Done-semantics changes beyond the circuit prescribed-count completion above, no segments-exist rule change, no post-session card changes, no yoga rejection change, no mobility pose cards or per-move status (decision still open), no evidenceVersion bump, no new infrastructure, accounts, cloud sync, AI keys, or paid APIs. Synthetic fixtures only.
- See [v111 update notes](docs/releases/V111-UPDATE-NOTES.md). Published from `main` at `601b795`; GitHub Pages workflow run #67 passed and deployed.

## v110 — built, not submitted

- FITLOG v3 parser (spec v2 §8): new `[FITLOG:3]` envelope extending the v2 parser (shared segmented implementation, not a copy). SEGMENT gains an optional label field (`SEGMENT|kind|duration|distance|label`) stored in the existing v108 `ActivitySegment.label` — no new stored field, no evidenceVersion change. The 4-field form still parses in v3; a 6th field errors; labels cannot contain `|` or newlines.
- Post-session rule extended in v3: SEGMENT lines rejected in yoga, grappling, soccer, and water_polo (exact post-session message pattern from the v108 follow-up) and in mobility (MOVE lines only). Rejection is checked after segment re-attachment, so REPEAT-built segments are caught. UI segments-exist rule unchanged (already-stored segmented activities still render). Under v2, only yoga is rejected, as before — old v2 blocks import exactly as before.
- AI prompt unification: `buildCoachPrompt` defaults to v3 in both modes (full v3 instructions for new briefs, condensed v3 reminder for continuing briefs); the duplicated v1+v2 OUTPUT FORMAT sections are gone — exactly one OUTPUT FORMAT section, and it is v3. V3 instructions carry a per-block don't-miss-fields checklist, INTERVALS scoped to summary-mode runs, circuit rounds with labeled stations, swim sets in m, and the post-session/mobility rules.
- Coach view: single "Copy v3 format" button replaces the v1/v2 buttons, plus a "Copy new profile paragraph" button for the updated `DEFAULT_COACH_PROFILE` format paragraph (INTERVALS scoped, circuit/swim/post-session rules); the app never rewrites a stored profile. Import dialog text names v3 and notes v1/v2 still import.
- Deliberate non-changes: no mobility pose cards (decision still open), no segment reorder, no circuit station results, no FORCE result rows, no v108/v109 stepper changes, no strength or totals changes, no new infrastructure.
- See [v110 update notes](docs/releases/V110-UPDATE-NOTES.md). Built locally only — NOT pushed, NOT deployed. Paul submits when he approves.

## v109 — built, not submitted

- Grouped steppers (spec v2 §7) reusing the v108 stepper engine: circuit activities WITH segments render a round stepper (one REPEAT iteration = one round; "Round N of M" + compact station list; "Done: Round N" completes only that round's unknown parts; "Done: all rounds" on the stepper), and swim activities WITH segments render an interval stepper (one iteration = one set; set cards list intervals compactly as label + distance + time; ungrouped segments are individual interval cards; "Done: Set N" / "Done: <plan>" / complete-all, same Undo/toast patterns). Show all lists units expandable to stations, with tap-part expansion for duration/distance actuals; group footers, Add part, and Repeat pattern keep working in Show all.
- View selection: only circuit/swim WITH segments get the grouped stepper; all other types keep the generic v108 stepper exactly as-is; circuit/swim WITHOUT segments keep their current routine/summary views, with no "Add parts" button added for circuit/swim.
- Circuit is prescription-and-completion only: actual station reps/load are NOT stored (no station-result model); differences go in notes. AMRAP is unsupported (no fixed rounds) and stays summary + notes; segment-free AMRAP activities are untouched by construction.
- v108 rules unchanged: unit completion touches unknown parts only; skips never auto-complete; as-prescribed stays labeled as prescribed; activity completion stays independent of parts completion.
- Deliberate non-changes: no mobility pose cards (Paul's decision pending), no v110 (no FITLOG v3 parser, no AI prompt changes, no v1/v2 parser edits), no stored-field changes, evidenceVersion stays 2, no new stored fields, no strength-logging or totals/labels changes.
- See [v109 update notes](docs/releases/V109-UPDATE-NOTES.md). Published from main at `1eb6e7b`; Pages run #65 passed and deployed.

## v108 — phone layout fixes (follow-up build, same version stamp)

- Stepper layout rules added (v108 shipped the stepper classes with no CSS, so phones fell back to browser defaults): current-part card with plan on its own line and intensity on its own quiet line, visible progress dots, Show-all rows that don't collide, 44px Done buttons kept.
- Import preview: Category control full-width under the activity name, same position for every block, no truncation.
- Effort rows: plan shown once per row; completing an effort keeps the same button in the same place with the checkmark added in place.
- FITLOG v2 parser now rejects yoga blocks with SEGMENT lines ("Yoga is recorded after the session: use MODE|summary with DURATION and NOTES, not SEGMENT lines."); summary yoga unaffected; already-stored segmented yoga still renders rather than hiding data. Grappling, soccer, water polo unchanged.
- Backup "newer release" comparison now understands dotted versions (v108.1, v108.2), so the warning fires correctly across patch releases.
- See [v108 follow-up update notes](docs/releases/V108-FOLLOWUP-UPDATE-NOTES.md). Published from main at `f019ab1`; Pages run #64 passed and deployed.

## v108 — interaction foundation

- Interaction foundation (spec v2 §3): the segment table is replaced by a stepper — current card + "Part N of M" text + progress dots + Show all compact cards, labeled "Done: <plan>" actions, tap-part expansion for one part at a time, "Complete all remaining as prescribed" on the stepper, and Undo for every Done tap. "Edit detail" is deleted; Add part and Repeat pattern live in the Show-all footer.
- Post-session cards for yoga, grappling, soccer, and water polo (duration + visible notes + labeled Done) when no segments exist; any activity WITH segments always shows the stepper. Mobility is a session card (moves read-only + duration + visible notes + labeled Done); pose cards pending Paul's decision.
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
