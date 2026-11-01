# Coach Loop v113 — update notes

Status: built from `main` (`3eabb87`).

## What changes

1. **Import Preview — every interval on its own line (`previewSegmentRows`):**
   - Repeated segments in Import Preview now display a compact `Repeat Nx` heading followed by each station or interval on its own individual dark row underneath (`app/domain/activity-segments.ts`, `app/views/today-view.tsx`).
2. **Routine AMRAP — structured exercise rows & compact rounds stepper:**
   - AMRAP prescriptions like `12 min AMRAP: 10 burpees, 15 kettlebell swings (24 kg), 200 m run` automatically render with a header (`12 min AMRAP`) and numbered dark rows for each exercise (`.amrap-plan`).
   - Replaced the stacked `Done round` / `Undo round` buttons with a single horizontal rounds stepper (`[ - ] 0 rounds done [ ✓ ]`).
3. **Minutes + Options side-by-side (`.activity-basics-row`):**
   - `Minutes` and `Activity options` / `More details` now sit side-by-side on one row, expanding full-width below when opened.
4. **Compact Sled / Force effort rows & shorter Done button:**
   - Effort rows now place the edit (`Pencil`) and complete (`Check`) icon buttons inline on the right of the effort row so each effort is a single compact bar.
   - Visually shortened the bottom activity completion button to `✓ Done · 12 min` (while preserving the full activity name for screen readers).
5. **Auto-advance focus fixed for 1-exercise and cardio-to-cardio transitions:**
   - Fixed the bug where completing a block when only 1 strength exercise existed did not auto-open the next incomplete block. Completing an exercise or activity now automatically opens the next incomplete block.
6. **Shorter Paste Dialog & Coach Format Example:**
   - Trimmed the Paste FITLOG dialog description to one concise sentence.
   - Replaced the segmented `[FITLOG:3]` example in Coach view with a clean, everyday **Barbell Back Squat + Easy run** example (`exampleFitlogV3()`), while `Copy format` still copies the complete v3 specification for your AI chat.

