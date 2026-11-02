# Coach Loop v116 Update Notes

Published: November 2026  
Governing rule: Prescription ≠ result, nothing invented, nothing silently dropped, FITLOG v3 is the only AI-facing format, phone is the deciding test.

---

## 1. Overview & Motivation

Release `v116` focuses on key UI/UX bug fixes, alignment repairs, touch containment, and visual cleanliness requested by user feedback following the `v115` deployment:

1. **Rest Interval Settings Offset & Clipping Fixed**:
   - Tapping the rest interval (e.g. `120s rest`) in strength exercises previously caused the popout settings panel (`.exercise-options-row`) to pop out shifted far to the left edge of the screen, cutting off labels and making text unreadable on narrow viewports.
   - Fixed by removing `position: relative` from the inline `.exercise-title-line` container and anchoring `.exercise-options-row` relative to `CardHeader` with `left: 12px; right: 12px; width: auto; max-width: 400px;`. The popout now expands cleanly within the exercise card boundaries with full readability and zero clipping.
2. **Dialog Backdrop Gutter Margins Restored**:
   - Replaced `[role="dialog"] { max-width: 100vw; }` with `[role="dialog"] { max-width: calc(100vw - 28px); margin-inline: auto; }`.
   - Dialogs such as "Bring a workout in" (Import) and "Build your coach brief" now preserve the visible darkened background borders on both screen edges instead of stretching 100% edge-to-edge.
3. **Three-Dots Dropdown Menu Alignment**:
   - Added `align="end" sideOffset={6} collisionPadding={16}` across strength exercises, cardio activities, history list options, and live workout header menus.
   - Prevents menu popovers from overflowing off the right edge of the screen.
4. **Close Button Collision in Coach Brief Builder**:
   - Added `pr-12` to `DialogHeader` to guarantee title and copy never collide with the top-right `X` close button.
   - Moved "Clear today’s fields" out of the header into the form body directly above the readiness inputs, labeled with "Today’s readiness & context", eliminating overlap with the dialog close button.
5. **Leg Press Plate Visualizer Simplification**:
   - Simplified `PlateVisualizer` for leg press: rather than repeating up to 16 individual plate badges across the card, it now displays each unique plate denomination as a single disc badge accompanied by a clean multiplier (e.g. `[45 disc] × 8 360 lb total`) with no collar bar.

---

## 2. Changes by File

- **`app/globals.css`**:
  - Replaced `[role="dialog"] { max-width: 100vw; }` with `[role="dialog"] { max-width: calc(100vw - 28px); margin-inline: auto; }`.
  - Set `.exercise-title-line { position: static; }` and `.exercise-card [data-slot="card-header"] { position: relative; gap: 6px; }`.
  - Updated `.exercise-setup[open] > .exercise-options-row` to use `position: absolute; left: 12px; right: 12px; width: auto; max-width: 400px; top: calc(100% + 2px);` so it remains fully contained inside the card without negative left offsets.
- **`app/views/today-view.tsx`**:
  - In `CoachDialog`: Added `pr-12` to `DialogHeader` and moved `Clear today’s fields` button into the dialog body above the readiness fields.
- **`app/views/workout-editor.tsx`**:
  - Updated `PlateVisualizer` for `isLegPress` to render single badges per plate size with `× N` multipliers and `{total} {unit} total`.
  - Added `align="end" sideOffset={6} collisionPadding={16}` to exercise and cardio card options menus and workout header dropdown menu.
- **`app/views/history-view.tsx`**:
  - Added `sideOffset={6} collisionPadding={16}` to history header and item dropdown menus.
- **`app/app-release.ts`**:
  - Bumped `APP_RELEASE` to `"v116"`.
- **`tests/`**:
  - Updated `tests/v106-phase0.test.ts`, `tests/release-journeys.test.cjs`, and `tests/v115-legpress-and-coach.test.ts` for release versioning.
  - Added `tests/v116-fixes.test.ts` testing dialog backdrop margins, rest options containment, coach dialog close button clearance, and dropdown menu safety.

---

## 3. Verification

- All 7 stages in `node scripts/check-release.mjs` passed:
  - TypeScript `--noEmit`: 0 errors
  - ESLint: 0 warnings, 0 errors
  - 379 tests passing: 0 failures
  - Production build: Vite bundle generated cleanly
  - PWA generation & behavior: 7 cached files verified, release `0b7768571b9a3ea992ba`
  - WebKit mobile smoke: iPhone navigation test passed
