# Coach Loop v118 Update Notes

Published: November 2026  
Governing rule: Prescription ≠ result, nothing invented, nothing silently dropped, FITLOG v3 is the only AI-facing format, phone is the deciding test.

---

## 1. Overview & Motivation

Release `v118` is a comprehensive stabilization, data-honesty, and polish release resolving findings consolidated from four independent QA and architectural audits:
- Full Repository Architecture Audit
- Live Desktop Automation QA
- Deep End-to-End Interactive QA
- Live Scenario & Counter-Honesty QA Report

This release enforces strict consistency across workout tracking, undo/skip operations, domain aggregation, input boundaries, and responsive mobile layouts.

---

## 2. Key Improvements & Fixes

### 1. Live Counter, Undo/Skip & Data-Honesty Fixes (D1 – D6)
- **Synchronized Live Rest Bar & Set Counter on Undo (D1)**:
  - Marking a completed set or sled effort incomplete now immediately recalculates the workout completion status, cancels any running rest countdown timer (`nextRestTarget`), and clears `"All work complete"` so the status bar and header counter remain in 100% agreement.
  - Automatically un-collapses the exercise card when an undone set leaves it incomplete.
- **Skipped Sets Denominator & Qualifier Reconciled (D2)**:
  - When sets are skipped, both the workout header and individual exercise cards clearly communicate active versus skipped counts (e.g. `0 of 2 active (1 skipped)` and `0/2 sets · 1 skipped`), preventing conflicting numbers on the same screen.
- **Direct Single-Tap "Unskip" Action (D4)**:
  - Skipped sets in both the Review sheet and individual set rows now provide a direct "Unskip" (restore to pending) action. Recovering from an accidental skip no longer forces the set through a false "Done" state.
- **Run Quick-Add Minutes Field Reset (D3)**:
  - In interval quick-add, duration input resets cleanly to placeholder `—` rather than reverting to a stale `5`, preventing accidental mislogging on subsequent taps.
- **Station Circuit Completion Transparency (D5)**:
  - Added scannable helper text next to the round counter on open-ended station circuits (`X rounds logged · Tap Mark complete when finished`) to clarify the distinct workflow from segment-free circuits.
- **Data-Honesty Qualifiers in Progress & Weekly Views (D6)**:
  - Unrecorded circuit durations honestly display as `time not recorded` rather than a misleading `0 min`.
  - When any completed effort within a session lacks recorded duration or distance, aggregated totals flag the missing metric rather than presenting a partial, artificially low total as complete.

### 2. Domain Aggregation & Input Boundary Hardening (P1 & P2)
- **Activity Effort Completeness Aggregation (P1)**:
  - `performedDuration` and `performedDistance` now verify that every completed effort has an actual value recorded. If any effort was left unrecorded, domain metrics report incomplete duration/distance rather than a truncated number.
- **Realistic Upper Bounds & Input Rejection (P2)**:
  - Enforced realistic upper bounds across both the persistence boundary schema (`storedStateBoundary`) and FITLOG parser:
    - Load: 5,000 lb / kg
    - Duration: 10,080 min (7 days)
    - Distance: 1,000 km / 1,000,000 m
    - Reps: 5,000
    - Sets: 500
    - Bodyweight: 5,000 lb / kg
  - Malformed or physically impossible values are cleanly rejected with human-scannable error messages.

### 3. Workout Editor UX & Responsive Rest Timer
- **Instant Exercise Title Auto-Sync**:
  - Typing an exercise name in blank/custom workouts immediately updates the state reference and draft on both keystroke and blur, preventing workouts from saving under default placeholder names when quickly navigating away.
- **Predictive Set Focus & Auto-Advance**:
  - Marking a set done smoothly advances focus to the next incomplete set without prematurely collapsing the card while work remains.
- **Compact Phone Rest Timer Bar**:
  - Rest timer bar and workout header dynamically compact on narrow screens (`<= 640px`) to prevent pushing the exercise action buttons below the fold on compact iPhone viewports.

### 4. FITLOG v3 Alignment, Safe Example & Diagnostics
- **Quick-Log Mobility Activity**:
  - Added "Mobility" with an active icon to the quick-log grid, validating cleanly against the persistence schema.
- **Swim Interval Quick-Add**:
  - Enabled interval logging for swim cardio sessions with custom "Add swim sets" button.
- **FITLOG Truncation Diagnostics**:
  - Added explicit diagnostic error when an AI-generated FITLOG block is truncated without a closing `[/FITLOG]` tag, guiding users to request the full block from their LLM.
- **FITLOG v3 Safe Import Example**:
  - Updated example workout to strict FITLOG v3 format (`MODE|summary`, Leg Press badge showcase, clean interval run).

### 5. Modal Layering, Date Picker Z-Index & Tab Hardening
- **Bodyweight Modal Loop Resolved**:
  - Fixed prompt state ref so saving bodyweight does not immediately re-trigger the dialog.
- **Dialog Backdrop & Z-Index Contrast**:
  - Enhanced dialog overlay with `bg-black/80 backdrop-blur-sm` and set `WorkoutDateDialog` to `z-[60]`, guaranteeing that date pickers and confirm dialogs never blend into background cards.
- **History Card Event Isolation & Tab Navigation Safety**:
  - Prevented card tap bubbling when expanding history summaries or clicking card action menus.
  - Switching main navigation tabs while a workout is open gracefully closes the editor without state corruption.

---

## 3. Changes by File

- **`app/app-release.ts`**:
  - Bumped `APP_RELEASE` to `"v118"`.
- **`app/domain/completion.ts`**:
  - Added incomplete measurement detection for `performedDuration` and `performedDistance`.
  - Added skipped set counter qualification to `workoutProgressCopy` and `exerciseSetProgress`.
- **`app/domain/training-coverage.ts` & `app/domain/training-workflow.ts`**:
  - Flagged incomplete duration and distance in volume and coverage rollups.
- **`app/domain/weekly-cards.ts`**:
  - Omitted `0 min` display and added `time not recorded` for unmeasured circuits.
- **`app/domain/training-types.ts` & `app/views/quick-log-buttons.tsx`**:
  - Added `mobility` to `QUICK_LOG_OPTIONS` with dedicated icon.
- **`app/persistence/training-validation.ts`**:
  - Enforced realistic maximum values across all numeric fields in `storedStateBoundary`.
- **`app/interchange/fitlog.ts`**:
  - Added bounds checking in `parseNonNegativeNumber`.
  - Added missing `[/FITLOG]` closing tag diagnostic error.
  - Aligned `exampleSafeImportFitlog` to strict FITLOG v3 specification.
- **`app/views/workout-editor.tsx`**:
  - Synchronized rest timer state and completion banner when sets are marked incomplete.
  - Implemented direct single-tap "Unskip" action.
  - Auto-uncollapsed exercise blocks when undone.
  - Reset interval quick-add duration placeholder cleanly.
  - Added helper guidance to station circuit completion.
  - Auto-synced exercise title changes on change and blur.
  - Supported swim interval quick-adds.
- **`app/globals.css`**:
  - Added compact responsive styles for `.workout-shell.has-rest-timer` on narrow viewports.
- **`components/ui/dialog.tsx` & `components/ui/alert-dialog.tsx` & `app/views/workout-date-dialog.tsx`**:
  - Upgraded overlay backdrop opacity and raised date-picker z-index.
- **`app/views/progress-view.tsx`**:
  - Added state ref to bodyweight dialog to prevent re-opening loop.
- **`app/views/history-view.tsx` & `app/shell/app-screens.tsx`**:
  - Stopped event propagation on card details and menus; added tab switch guard to close active workout safely.
- **`tests/`**:
  - Added `tests/v118-stabilization.test.ts` (8 domain, schema, and parser tests).
  - Added `tests/v118-ui.test.cjs` (2 DOM integration tests for undo/skip synchronization).
  - Updated `e2e/mobile-navigation.spec.ts` with iPhone 390x844 navigation and workout lifecycle assertions.
  - Updated release assertion tests across test suite.

---

## 4. Verification & Quality Gate Results

All 7 stages of `node scripts/check-release.mjs` passed with zero errors and zero warnings:
1. **TypeScript**: `tsc --noEmit` — 0 errors
2. **ESLint**: `eslint` — 0 warnings, 0 errors
3. **Test Suite**: `node --import tsx --test` — **394 / 394 tests passed** (0 failures)
4. **Production Build**: `vite build` — bundle generated cleanly
5. **PWA Generation**: `scripts/build-pwa.mjs` — manifest and service worker generated
6. **PWA Behavior**: `scripts/check-pwa.mjs` — offline caching and shell verified
7. **WebKit E2E Smoke**: `playwright test` — mobile phone navigation & workout lifecycle passed
