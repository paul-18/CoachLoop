# Coach Loop v103

Baseline: v102. The source diff does not change IndexedDB schema or backup format. The current main commit marks the app as v103.

- Activity results with zero duration or implausibly fast distance/time combinations show a warning without rewriting entered values.
- Finishing prompts when actual activity results were entered but not marked complete. The user can mark the entered results complete, leave them incomplete, or return to the workout.
- Rest-timer Next advances from the completed block to the next open block and does not jump back to earlier work.
- Warm-ups display as W1, W2, etc.; working sets begin at Set 1 in previews and active workouts.
- Starter removal remains available whenever the starter setup can be removed. New-log quick-log choices are consistent, and customized lists are preserved.
- FITLOG mobility parsing strips trailing separators in one pass to avoid pathological backtracking.

The v103 commit message records that release checks passed and names PWA release `14c47965eaa5d5549125`. This note does not claim that a physical iPhone was used.
