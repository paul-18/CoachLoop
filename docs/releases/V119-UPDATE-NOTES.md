# Coach Loop v119 Update Notes

Published: November 2026  
Governing rule: Prescription ≠ result, nothing invented, nothing silently dropped, FITLOG v3 is the only AI-facing format, phone is the deciding test.

---

## 1. Overview & Motivation

Release `v119` is a targeted polish and alignment release closing specific residual findings discovered during the multi-agent `v118` post-release verification audits:
- **Synchronized Skipped-Set Counter on Exercise Cards**: Brings card headers and workout headers into complete lockstep when sets are skipped or unskipped.
- **Segment-Free Circuit Completion Guidance & Grammar**: Adds clear guidance to segment-free circuits explaining how round logging relates to completion, and fixes singular/plural round grammar.
- **Clean Fractional Minute Rounding**: Eliminates raw IEEE-754 repeating float tails in plan review differences, finish summaries, and coach export copy.
- **Distance-Honesty Display in Progress**: Omit misleading `0 km` / `0 mi` prefixes when an activity's distance was intentionally unrecorded.
- **Root README.md FITLOG:3 Alignment**: Fixed field order to valid `WORKOUT|name|YYYY-MM-DD` and added an automated parser test ensuring all fenced documentation examples pass validation with 0 errors and 0 warnings.
- **Primary Tab Navigation Hardening**: Cleanly saves and collapses active workout editors when switching primary tabs from either the desktop rail or mobile bottom bar, across both fresh empty profiles and populated states.
- **Transparent Quality-Gate Reporting**: Distinguishes between zero test/ESLint failures and non-blocking build notices (Vite chunk size).

---

## 2. Key Improvements & Fixes

### 1. Synchronized Skipped-Set Count & Qualifier (Exercise Card & Header)
- Added `exerciseProgressCopy` in `app/domain/completion.ts` to mirror the exact format of `workoutProgressCopy` (e.g. `2/2 sets · 1 skipped` or `0/2 sets · 1 skipped`).
- Rendered this compact summary badge in both expanded and collapsed exercise card headers in `app/views/workout-editor.tsx`.
- Whenever sets are skipped, unskipped, added, or removed, both the exercise card badge and the top workout header update immediately in lockstep.

### 2. Segment-Free Circuit Helper Copy & Singular/Plural Grammar
- Added clear helper copy below round counters on segment-free circuits: `X rounds logged · Tap Done / Mark complete when finished`.
- Fixed round grammar across all toast notifications and counter labels: `1 round done` / `1 round logged` when count is 1, and `X rounds done` / `X rounds logged` otherwise.

### 3. Fractional Minute Rounding in Plan Differences & Coach Export
- Replaced unformatted `${plannedDurationMin} min` and `${plannedDistanceKm} km` with `${formatMeasure(plannedDurationMin)} min` and `${formatMeasure(plannedDistanceKm)} km` across `app/domain/plan-review.ts` and `app/interchange/coach-export.ts`.
- Sub-minute planned intervals (e.g. 40 sec / 60 = 0.6666666666666666 min) now display cleanly as `0.67 min` without raw float tails.

### 4. Progress Honesty Polish: Omit Misleading "0 km" on Unrecorded Distance
- Updated `app/views/training-review.tsx` and `app/domain/weekly-cards.ts` to omit the `0 km` / `0 mi` prefix when `totals.distanceIncomplete` is true.
- Unrecorded distance sessions in Progress and weekly cards now display `1 session · 2 min · distance not fully recorded` rather than implying 0 km was achieved.

### 5. Documentation FITLOG Example Validation
- Fixed `README.md` example to valid FITLOG:3 syntax: `WORKOUT|Example strength and easy run|2026-11-01` with `MODE|summary` on the run block.
- Added automated unit test in `tests/v119-alignment.test.ts` that extracts the fenced code block from `README.md` and verifies `parseFitlog` completes with 0 errors and 0 warnings.

### 6. Primary Tab Navigation Hardening from Open Workout Editor
- Refactored shell hosting so `WorkoutScreen` is mounted inside the Today tab content, preserving access to the desktop navigation rail and mobile navigation bar.
- Clicking any primary navigation tab (Today, History, Coach, Progress, Settings) in either the desktop rail or mobile bottom bar while a workout editor is open cleanly collapses the active editor into the "WORKOUT IN PROGRESS" state on Today and immediately transitions to the chosen tab.
- Works identically in a pristine empty database state (0 completed workouts) and a populated state.
- Covered by unit/DOM test in `tests/v118-ui.test.cjs` and Playwright WebKit test in `e2e/mobile-navigation.spec.ts`.

---

## 3. Changes by File

- **`app/app-release.ts`**:
  - Bumped `APP_RELEASE` to `"v119"`.
- **`app/domain/completion.ts`**:
  - Added `exerciseProgressCopy` to produce matching active denominator and skipped set qualifiers for exercise cards.
- **`app/views/workout-editor.tsx`**:
  - Added `.exercise-card-progress` badge to expanded and collapsed exercise card headers.
  - Added `.routine-rounds-helper` guidance to segment-free circuits.
  - Fixed singular/plural round grammar in counters and toasts.
- **`app/domain/plan-review.ts` & `app/interchange/coach-export.ts`**:
  - Rounded planned duration and distance with `formatMeasure` to prevent repeating float tails.
- **`app/views/training-review.tsx` & `app/domain/weekly-cards.ts`**:
  - Omitted `0 km` prefix when distance is flagged as unrecorded.
- **`app/shell/app-screens.tsx` & `app/workout-app.tsx` & `app/shell/use-workout-controller.ts`**:
  - Preserved navigation bar/rail while workout is active and ensured tab clicks collapse editor into active workout card.
  - Set `setView("today")` when starting or resuming workouts.
- **`app/globals.css`**:
  - Positioned `.desktop-rail` with `z-index: 50` and offset workout header on desktop viewports.
- **`README.md`**:
  - Fixed FITLOG:3 sample syntax and added v119 update release notes.
- **`docs/releases/V118-UPDATE-NOTES.md` & `docs/releases/V119-UPDATE-NOTES.md` & `CHANGELOG.md`**:
  - Accurate QC release gate wording reflecting non-blocking Vite chunk notices.
- **`tests/`**:
  - Added `tests/v119-alignment.test.ts` (5 unit tests).
  - Extended `tests/v118-ui.test.cjs` (2 integration tests).
  - Extended `e2e/mobile-navigation.spec.ts` (Playwright WebKit tab switching test).
  - Updated release assertions across existing test files.

---

## 4. Verification & Quality Gate Results

All 7 release-check stages passed with zero test or ESLint failures/warnings (non-blocking Vite bundle-size notice only):
1. **TypeScript**: `tsc --noEmit` — 0 errors
2. **ESLint**: `eslint` — 0 warnings, 0 errors
3. **Test Suite**: `node --import tsx --test` — **401 / 401 tests passed** (0 failures)
4. **Production Build**: `vite build` — bundle generated cleanly (non-blocking chunk minification size notice)
5. **PWA Generation**: `scripts/build-pwa.mjs` — manifest and service worker generated
6. **PWA Behavior**: `scripts/check-pwa.mjs` — offline caching and shell verified
7. **WebKit E2E Smoke**: `playwright test` — 3/3 tests passed (including empty-state tab navigation hardening at 390x844)
