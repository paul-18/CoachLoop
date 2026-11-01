# Coach Loop v114 — update notes

Status: built from `main` (`724b761`).

## What changes

1. **iPhone 17 Dynamic Island & PWA Safe-Area Clearance:**
   - Updated standalone PWA safe-area top fallback from 56px to 59px (`max(env(safe-area-inset-top, 0px), 59px)` in `app/globals.css`), matching the exact 59pt Dynamic Island sensor dimension on iPhone 14 Pro, 15, 16 Pro, and 17.
   - Added `-webkit-touch-callout: none` and `user-select: none` across the workout header, cards, and mobile navigation bar to prevent accidental text magnification or selection with sweaty hands in the gym.
2. **Apple HIG Touch Targets (Sub-44px Fix):**
   - Added `min-h-11 min-w-11` (44px) to the workout `Discard` button in `app/views/workout-editor.tsx`.
3. **Refactoring UI: Reduced Nested Borders & Surface Hierarchy:**
   - Replaced multiple nested borders inside segmented circuit stations and AMRAP exercise rows with subtle surface luminance shifts (`rgba(255,255,255,.04)` background with `border: none`).
   - Removed the duplicate `Round 1 of 3` inner heading in segmented circuits (hidden visually with `sr-only` to maintain screen-reader accessibility).
4. **Distance Field on Interval Runs:**
   - Interval-based runs, walks, hikes, rucks, swims, rows, and bikes now show the `Distance` input beside `Minutes` so athletes can easily enter total session distance at the end of interval training.
