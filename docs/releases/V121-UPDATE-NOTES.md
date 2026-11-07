# Coach Loop v121 Update Notes

Published: November 2026  
Governing rule: prescription ≠ result; nothing invented or silently dropped; FITLOG v3 remains the AI-facing format; phone behavior remains the deciding test.

---

## 1. Overview

Release `v121` delivers the Finish Workout **Session effort** redesign, the full v120/v121 PWA & iOS Safari polish suite, and 17 code-verified data-integrity and UI/UX fixes across the live workout editor, history, CSV export, and workout copy/substitution workflows.

## 2. Highlights & Changes

### A. Prominent Session Effort in Finish Workout Dialog
- **Top-of-dialog Session Effort card (`.finish-effort-card`)**: Moved **Session effort** out of the collapsed `<details>` at the bottom of the Finish Workout dialog and placed it at the very top of `.finish-review`, immediately visible and inclined to be filled.
- **One-tap quick RPE chips + custom input**: Added 5 quick-select RPE buttons (`6 · Easy`, `7 · Moderate`, `8 · Hard`, `9 · Very hard`, `10 · Max`) alongside the decimal input (`Session effort out of 10`) for custom values such as `7.5`.
- **Effort & notes persistence across `Keep training`**: Updating Session effort or Notes in the Finish dialog now persists immediately to the active workout even when `finishCandidate` is active from the unconfirmed-actuals prompt, without prematurely committing staged cardio completion if the user cancels.

### B. PWA, iOS Safari & Mobile Ergonomics
- **Explicit "Check updates" confirmation (`app/pwa/use-offline-status.ts`, `app/views/settings-view.tsx`)**: Tapping **Check updates** in Settings now refreshes registration state and reports `"You're up to date"`, `"Update downloaded — use Restart to update"`, or `"Update check failed; try again while online."`.
- **Today header update indicator (`app/views/today-view.tsx`)**: Displays a compact pill (`● v121 Update`) next to the date on Today only when a downloaded update is waiting, opening Settings on tap.
- **iOS Safari bottom tab bar & keyboard hardening (`app/shell/app-screens.tsx`, `app/globals.css`, `components/ui/input.tsx`, `components/ui/textarea.tsx`)**:
  - Prevents `.mobile-nav` from getting stuck mid-screen after scrolling or app resume via `overflow-x: clip`, GPU layer promotion, `data-keyboard-open="true"` hiding while the software keyboard is open, and a two-frame `translate3d` compositor re-anchor on `visibilitychange` / `pageshow` / `focusout`.
  - Prevents iOS Safari from suggesting the user's Contact Name above free-text notes fields by setting `autoComplete="off"`, `autoCorrect="on"`, `autoCapitalize="sentences"`, `spellCheck={true}`, and `data-form-type="other"`.
- **Sleek dialog close button (`components/ui/dialog.tsx`)**: Keeps the visual `X` icon compact (`size-4` / `16×16px`) while adding `-m-2 p-2` invisible touch padding.
- **Skip link, manifest metadata & bundle splitting (`index.html`, `public/manifest.webmanifest`, `vite.config.ts`)**: Added keyboard/VoiceOver skip link (`Skip to main content`), `mobile-web-app-capable` meta tag, rich manifest metadata (`lang`, `dir`, `categories`, `screenshots`, `shortcuts`), Safari/Home Screen multi-window update guidance, and vendor/domain chunk splitting.

### C. Workout Editor, Domain & History Fixes
- **Consistent working-set numbering after warm-ups (`app/views/history-view.tsx`, `app/domain/plan-review.ts`, `app/interchange/training-csv.ts`)**: Working sets following warm-up sets are now consistently numbered from `1` (`W1, 1, 2`) across History details, Finish Workout `Changed from plan`, and CSV export.
- **Multi-activity open state (`app/views/workout-editor.tsx`)**: Replaced single `openActivityId` override with `openActivityIds` so opening a second activity card in a multi-activity workout no longer forces the first open activity card to collapse.
- **Effort rest timer tracking (`app/views/workout-editor.tsx`)**: Passes `effort.id` to `onCompleteEffort` (`restFrom.setId`) so editing another effort no longer prematurely cancels an active effort rest countdown.
- **Weight step (`+/−`) reference set (`app/views/workout-editor.tsx`)**: Uses the first remaining uncompleted set (`sets.find(s => !s.completed && !s.skipped) ?? sets[0]`) for unit and weight-mode matching so changing unit/mode mid-exercise keeps `+/−` weight step active.
- **Exercise substitution & workout copy/replan (`app/domain/training-workflow.ts`, `app/domain/workout-copy.ts`)**:
  - `substituteExercise` now preserves `plannedRpe`, `plannedRir`, and set `unit` on remaining sets.
  - `repeatWorkoutDraft` falls back to `plannedDurationMin` / `plannedDistanceKm` and effort prescriptions when a completed activity has `null` actuals.
  - `replanWorkoutDraft` clears `importFingerprint`, `importWarnings`, `deletedExerciseIds`, `deletedActivityIds`, `deletedSetIds`, `averageHr`, `elevationM`, and `pace`.
- **Undo tombstones & stepper polish (`app/views/workout-editor.tsx`, `app/views/hyrox-ui.tsx`, `app/views/today-view.tsx`, `app/views/training-review.tsx`)**:
  - Undoing set, exercise, or activity removal restores the original ID and removes it from `deleted*Ids`.
  - Swim `Add swim sets` mounts `GroupedActivityStepper` directly without component swapping on first add; switching expanded intervals clears stale `labelError`.
  - `HyroxWorkout` debounces only repeated identical actions so `Resume` → `Complete segment` is never dropped.
  - `SavedPlanPreview` renders HYROX segments when previewing a planned HYROX workout, and `MonthlyReviewContent` formats single bodyweight entries cleanly (`1 measurement`).

## 3. Verification

All 7 stages of `pnpm release:check` (`typecheck`, `lint`, unit/DOM tests, production `build`, `pwa:build`, `pwa:check`, and Playwright WebKit E2E smoke tests) pass with zero errors and zero warnings.
