# Coach Loop v122 Update Notes

## Summary

Release **v122** implements live Personal Record (PR) detection, a reusable Workout Templates library, Superset / Paired Exercise grouping (`A1` / `A2`) with round-alternating rest progression, and a comprehensive set of data-integrity, PWA manifest, and accessibility refinements.

## New Features

1. **Live PR / Rep-Max Detection & Celebration Badge (`app/domain/personal-records.ts`, `app/views/workout-editor.tsx`, `app/views/history-view.tsx`)**
   - Compares completed working sets against all prior completed sessions per canonical exercise identity, load type, and weight mode.
   - Surfaces a compact `PR` pill badge on record-breaking sets (`Load PR`, `e1RM PR`, or `Rep PR`) in the live workout editor, collapsed exercise summary, and History workout details, plus a celebratory **New personal records** banner in the Finish Workout dialog.
   - First-time exercises without prior completed history never trigger false PR badges.

2. **Saved Workout Templates / Routine Library (`app/domain/workout-copy.ts`, `app/shell/use-workout-controller.ts`, `app/views/today-view.tsx`, `app/views/history-view.tsx`)**
   - Save any planned, active, or completed workout to your reusable **Saved templates** library from History (`⋯ → Save as template`), Saved Plan Preview (`Save as template`), or the live Workout Editor (`⋯ → Save as template`).
   - Starting a template from Today's **Saved templates** section creates a fresh active copy for today while keeping the template untouched in your library.
   - Templates are excluded from dated `SAVED PLANS` in AI Coach briefs so reusable routines are never mistaken for scheduled upcoming plans.

3. **Superset / Paired Exercise Grouping (`A1 / A2`) (`app/domain/completion.ts`, `app/domain/training-workflow.ts`, `app/views/workout-editor.tsx`)**
   - Pair adjacent exercises into supersets (`A1`/`A2`, `B1`/`B2`) from any exercise's `⋯` menu (`Link superset with ...` / `Unlink superset`).
   - Displays `A1`/`A2` badges across the Workout Editor, Plan Preview, History, and Coach exports.
   - `nextRestTarget` and `nextOpenBlock` automatically alternate between superset exercises round-by-round (`A1 Set 1 → A2 Set 1 → A1 Set 2 → A2 Set 2`) before advancing to subsequent blocks.

## Data Integrity, PWA & Accessibility Fixes

- **Warm-Up vs. Working Set Numbering in Coach Exports & Backup Review**: `compactSetLines` (`app/interchange/coach-export.ts`) and `workoutDifferences` (`app/persistence/backup-review.ts`) now use `setDisplayNumbers(sets)` (`W1` for warm-ups, `1..N` for working sets) and never group warm-up sets with working sets.
- **Completed History `.txt` & CSV Export Completeness**: `exportCompletedHistory` (`app/interchange/history-export.ts`) and `trainingCsvRows` (`app/interchange/training-csv.ts`) now include completed segment counts (`segmentCountLabel`) and circuit `roundsDone` when duration/distance are unrecorded.
- **Starter Seed Stripping on Repeat/Replan**: `repeatWorkoutDraft` and `replanWorkoutDraft` (`app/domain/workout-copy.ts`) now strip `starterSeed` and `isTemplate`, and remap `supersetId` values to fresh IDs.
- **Unified 7-Day Window Helper**: `weeklyCards` (`app/domain/weekly-cards.ts`) now uses `localDateDaysEarlier(6, today)` consistently with `trainingInsights`.
- **PWA Manifest & Orientation Lock Setting**:
  - `public/manifest.webmanifest` now includes raster PNG screenshots (`screenshot-narrow.png` and `screenshot-wide.png`), `"launch_handler": { "client_mode": "navigate-existing" }`, and `"orientation": "any"` by default for tablet/desktop flexibility.
  - Added a **Lock to portrait orientation** toggle (`settings.portraitLock`) under **Settings → Appearance & quick log**.
- **Service Worker & Storage Health Hardening**:
  - `scripts/build-pwa.mjs` filters out hidden dotfiles when building the precache asset list.
  - `useStorageHealth` (`app/pwa/use-storage-health.ts`) requests `navigator.storage.persist()` only on initial mount rather than on every `visibilitychange`.
  - Removed redundant `touchend` compositor transform thrashing in `AppScreens` (`app/shell/app-screens.tsx`).
- **Accessibility & Navigation Polish**:
  - Scoped `role="status"` in the workout header to the save-status span only and allowed a 2-line clamp on `.workout-header-progress`.
  - Upgraded `#main-content` to a semantic `<main>` landmark, wrapped desktop rail navigation in `<nav aria-label="Primary">`, and synchronized `document.title` and URL `?view=` query state with `popstate`.
