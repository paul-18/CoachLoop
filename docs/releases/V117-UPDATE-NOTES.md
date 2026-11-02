# Coach Loop v117 Update Notes

Published: November 2026  
Governing rule: Prescription ≠ result, nothing invented, nothing silently dropped, FITLOG v3 is the only AI-facing format, phone is the deciding test.

---

## 1. Overview & Motivation

Release `v117` polishes the history export inputs, refines the sample workout shown in the import dialog, and balances the visual weight of active interval completion buttons:

1. **History Export Input Alignment**:
   - Fixed the layout offset where the `From` and `To` date input rectangles shifted too far to the right in the Export History dialog.
   - Enforced `display: block` on `.field-label` so input elements do not inherit inline indentation from the label text.
   - Restructured the mobile controls into a balanced 2-column grid (`grid grid-cols-2 gap-3 sm:grid-cols-3`) with `From` and `To` sitting side-by-side as a clean pair and `Exercise` spanning full width below them (`col-span-2 sm:col-span-1`).
   - Added `[color-scheme:dark] text-left` and `::-webkit-date-and-time-value { text-align: left }` so date text aligns neatly to the left without iOS rightward drift.
2. **Import Safe Example Refinement**:
   - Removed the redundant "Load a segments example" button from the Import dialog, streamlining to a single clear action: "Load a safe example".
   - Updated the safe import example (`exampleSafeImportFitlog`) to showcase:
     - Barbell Bench Press with warmups and working sets.
     - Leg Press with working sets (demonstrating the new compact plate disc badge notation e.g. `[45 disc] × 8 360 lb total`).
     - A run with intervals: `4 x (3 min run / 1 min walk)` with duration, distance, intensity, and coach notes.
     - Easy mobility moves.
3. **Subdued Active Interval Button**:
   - Softened the active interval action button (`.stepper-done-current`) from an overwhelming extra-bold 800 to a calm semi-bold 650 with balanced text sizing (`.84rem`).
   - Prevents descriptive interval labels like `Done: tempo cruise 4 min 1 km` from overpowering the screen while keeping the primary action distinct and accessible.

---

## 2. Changes by File

- **`app/globals.css`**:
  - Added `display: block;` to `.field-label`.
  - Added left-alignment and dark color scheme for `input[type="date"]` and WebKit shadow DOM date text.
  - Reduced font weight on `.stepper-done-current` from `800` to `650` with `font-size: .84rem`.
- **`app/views/history-view.tsx`**:
  - Restructured export filter fields to `grid grid-cols-2 gap-3 sm:grid-cols-3` with `block` labels and left-aligned date inputs.
- **`app/interchange/fitlog.ts`**:
  - Added `exampleSafeImportFitlog` featuring Leg Press and an interval run without complex segment repeats.
- **`app/views/today-view.tsx`**:
  - Switched "Load a safe example" to `exampleSafeImportFitlog`.
  - Removed "Load a segments example" button and copy.
- **`app/app-release.ts`**:
  - Bumped `APP_RELEASE` to `"v117"`.
- **`tests/`**:
  - Updated release assertions in `tests/v106-phase0.test.ts`, `tests/release-journeys.test.cjs`, `tests/v115-legpress-and-coach.test.ts`, `tests/v116-fixes.test.ts`.
  - Updated `tests/v108-journeys.test.cjs` to test preview collapse via direct textarea input and review.
  - Added `tests/v117-history-and-import.test.ts`.

---

## 3. Verification

- All 7 stages in `node scripts/check-release.mjs` passed:
  - TypeScript `--noEmit`: 0 errors
  - ESLint: 0 warnings, 0 errors
  - 384 tests passing: 0 failures
  - Production build: Vite bundle generated cleanly
  - PWA generation & behavior: 7 cached files verified
  - WebKit mobile smoke: iPhone navigation test passed
