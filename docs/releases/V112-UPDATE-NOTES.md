# Coach Loop v112 — update notes

Status: built from `main` (`601b795`).

This release addresses all 10 items from Paul's iPhone 17 review of `v111`, removes the confusing `Logging style` selector from `More details`, and fixes data/export edge cases found during our `v111` audit.

## What changes

### 1. Coach view `"Need the FITLOG format?"` horizontal overflow fixed
- Wrapped `.coach-quick-controls` (`flex-wrap: wrap`), added `overflow: hidden` to `.coach-format-disclosure`, and styled `.fitlog-example` as a dark bordered code block with `white-space: pre-wrap` and `overflow-wrap: anywhere` so expanding `"Need the FITLOG format?"` never pushes the page off-screen on iPhone 17.
- Removed the remaining two `"part"` strings in `FITLOG_V3_INSTRUCTIONS` (`app/interchange/fitlog.ts`).

### 2. Import preview & prescription cards styled like Strength
- Segmented preview items (`.import-preview-lines li`) and effort preview rows on the Import Preview screen now render as individual dark cards (`rounded-lg border border-white/7 bg-black/25 px-2.5 py-1.5`) matching the Strength set list.
- `.run-plan` and `.activity-instructions` in the workout editor now use a dark prescription card surface (`rgba(0,0,0,.24)` with subtle border) instead of looking identical to the blue left-bordered `.coach-cue`.

### 3. Segmented Circuits (`Round 1 of 3`) — Undo round, line-by-line stations, compact card
- Added an `Undo round` button next to `Done round` and placed `N rounds done`, `Done round`, `Undo round`, and `Add another round` inside a clean `.stepper-rounds-bar`.
- Stations under `Round 1 of 3` (and intervals under Swim `Set 1 of 4`) now render on their own distinct dark rows (`.stepper-unit-station-row`) on the next line under the header instead of gluing together into a single paragraph.
- Compacted the circuit card by tucking the detailed per-round/per-station editor into `<details className="activity-details activity-stepper-units"><summary>Rounds & stations (N rounds)</summary>...</details>` without duplicate per-station `Done:` buttons, and suppressed the duplicate routine-rounds counter when segments exist.

### 4. Swim `Show all` spacing & consistency
- Swim set cards inside `Show all` now wrap the title and status badge inside `.stepper-unit-summary` with clean grid spacing and line-by-line interval rows.

### 5. Sled / Force (`efforts`) — dark cards & live top-line update on `"Did different"`
- Styled `.activity-effort` rows as dark cards matching Strength sets.
- When logging different actuals via `"Did different"` (weight, distance, or reps/rounds), the main top row text (`.activity-effort-plan-text`) immediately updates to show what was actually performed while keeping `· prescribed ...` visible alongside it.
- Undoing a completed effort that had copied as-prescribed values resets those copied actuals to `null` while preserving user-modified actuals.

### 6. Compact header collapse arrow & one-block-at-a-time focus
- Replaced the full-width `Collapse` button at the top of `CardContent` (which created extra top whitespace) with a compact `<ChevronUp />` collapse arrow button in the card header right next to `...` (`More details`) on both Strength exercises and non-strength activities.
- Added `"Collapse other blocks"` / `"Focus current block"` in the workout editor header and one-open-at-a-time auto-advance: opening or completing a block collapses other expanded blocks and advances focus to the next incomplete block.
- Styled routine `Undo` (`-1 round`) as a proper button (`Undo round`).

### 7. Multi-line button wrapping for long activity names
- Updated `.activity-editor button`, `.stepper-done`, and `.stepper-done-current` in `app/globals.css` with `white-space: normal; height: auto; min-height: 44px; padding-block: 8px; line-height: 1.25` so long labels like `"Done: Lower Body & Thoracic Recovery 12 min"` wrap cleanly across lines without clipping or overflowing.

### 8. Removed `Logging style` dropdown from `More details`
- Removed the manual `Logging style` dropdown from `More details` in `CardioEditor` so users never have to think about internal logging modes. The app picks the right interface automatically from the activity type and FITLOG structure, and blank `force` activities show a direct `+ Add effort` button. `loggingStyle` remains in the TypeScript/Zod schema for full backward compatibility.

### 9. Data & export integrity fixes
- **Repeat / Replan resets `roundsDone`:** `repeatWorkoutDraft` and `replanWorkoutDraft` now reset `roundsDone: undefined` so repeating a workout starts fresh at 0 rounds.
- **Routine `roundsDone` recognized as logged work:** `completion.ts` (`hasCompletedActivityWork`, `activityHasTypedActual`, `unconfirmedActualActivities`, `unconfirmedActualKey`), `history-view.tsx`, and `coach-export.ts` now include `roundsDone > 0` so routine circuit rounds count as work, prompt for finish confirmation if left uncompleted, show in History, and export `- Rounds completed: N` in the AI Coach summary.
- **Rep-based segmented circuit duration in Coach export:** `coach-export.ts` now emits `- Session duration: X min as prescribed` when a segmented activity has an activity-level `DURATION` that isn't summed from timed segments.
- **Weekly cards incomplete minutes:** `weekly-cards.ts` checks `flagMinutes` so incomplete time-based activities show `"Not fully recorded"` instead of `"0 min"`.
- **FITLOG v2/v3 parser:** `fitlog.ts` strips `REPEAT | N` / `SEGMENT | ...` lines with optional spaces before `|` from `v1Body` so they never trigger false unknown-tag warnings.

