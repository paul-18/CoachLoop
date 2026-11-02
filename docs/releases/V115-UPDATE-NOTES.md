# Coach Loop v115 Update Notes

Published: November 2026  
Governing rule: Prescription ≠ result, nothing invented, nothing silently dropped, FITLOG v3 is the only AI-facing format, phone is the deciding test.

---

## 1. Overview & Motivation

Release `v115` addresses specific user feedback regarding layout alignment, plate loading math, training history flexibility, mobile dialog density, and viewport containment on iOS:

1. **Leg Press Plate Calculation**: Added dedicated plate breakdown for leg press exercises (`/leg press/i`). Unlike barbell exercises which subtract a 45 lb / 20 kg bar and divide remaining load across two sleeves, leg press calculates plate loading directly from total weight loaded (assuming 0 collar weight) using grouped multiplication syntax: e.g. `45 × 7 lb` for 315 lb, `45 × 6 + 25 lb` for 295 lb, and `45 × 14 lb total (45 × 7 per side)` for 630 lb.
2. **Import Preview Layout & Spacing**:
   - Replaced awkward left offset (`.preview-nested { margin-left: 14px }`) with an aligned layout featuring a subtle lime left accent bar (`border-left: 3px solid var(--lime)`), ensuring nested repeat items align flush with the parent card margins.
   - Streamlined the Category picker into a compact inline dropdown beside the activity title, preventing lower circuit cards from being pushed excessively down the page.
3. **Expanded Coach Training History Ranges**:
   - Quick update for existing chat (`CoachView`) now offers: `Last workout`, `Today`, `Last 2 days`, `Last 7 days`, `Last 14 days`, `Last 30 days`, and `Last 60 days`.
   - Coach Brief Builder (`CoachDialog`) now supports: `Latest completed session`, `Last 1 day`, `Last 2 days`, `Last 7 days`, `Last 14 days`, `Last 30 days`, and `Last 60 days` across both "Continue existing chat" and "Start a new chat" modes.
4. **History Export Viewport Containment**:
   - Enforced `overflow-x: hidden` on `html`, `body`, `.page-stack`, and dialog overlays.
   - Constrained history export dialog and preformatted text (`touch-action: pan-y; max-w-[calc(100vw-2rem)]; min-w-0`), completely eliminating horizontal wobble / left-right page shifting on iOS WebKit.
5. **Streamlined Coach Brief Dialog**:
   - Condensed dialog header with a quick "Clear today" action button.
   - Arranged Energy, Sleep, Soreness, and Restrictions into a compact 2-column mobile grid.
   - Reduced padding and textarea heights to eliminate unnecessary vertical scrolling on iPhone 17.

---

## 2. Changes by File

- **`app/domain/training-types.ts`**:
  - Expanded `CoachOptions.days` to `0 | 1 | 2 | 7 | 14 | 30 | 60`.
- **`app/interchange/coach-export.ts`**:
  - Added `"seven-days" | "fourteen-days" | "thirty-days" | "sixty-days"` to `QuickTrainingRange`.
  - Updated `buildQuickTrainingExtract` date window calculation for all ranges.
- **`app/views/coach-view.tsx`**:
  - Added dropdown options for 7, 14, 30, and 60 days in Quick update.
- **`app/views/today-view.tsx`**:
  - Added 2-day and 60-day history options to `CoachDialog`.
  - Streamlined `CoachDialog` form into a compact 2-column grid.
  - Aligned preview segment cards and compacted Category select.
- **`app/views/workout-editor.tsx`**:
  - Added `isLegPress` helper.
  - Added `formatGroupedPlates` for concise multiplication notation (`45 × 7`, `45 × 6 + 25`).
  - Enabled `PlateVisualizer` for leg press using direct total weight with zero collar weight.
- **`app/views/history-view.tsx`**:
  - Constrained dialog content with `overflow-x-hidden`, `max-w-[calc(100vw-2rem)]`, and `min-w-0` on date inputs.
- **`app/globals.css`**:
  - Set `overflow-x: hidden` on `html`, `body`, `.page-stack`, and dialog contents.
  - Updated `.preview-nested` to use border accent instead of margin shift.
- **`app/app-release.ts`**:
  - Bumped release to `"v115"`.
- **Tests**:
  - Updated `tests/v106-phase0.test.ts` and `tests/release-journeys.test.cjs` release assertions to `v115`.
