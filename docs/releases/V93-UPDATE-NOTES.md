# v93 — backup integrity and review polish

Baseline: GitHub commit `96ad086183df5f229805a32e62fce9a09d7c171e` (v92). This package is a source overlay; no files require deletion.

## Changes

- Set-number/W menus offer Insert set before and Insert set after. New rows inherit the selected set’s prescription, units, load meaning and warm-up type, with new IDs and empty actual results. Existing set order, IDs and recorded evidence are preserved. Insert after the final warm-up for another warm-up before the first working set. Mark as warm-up/working remains available, and bottom Add set remains available.

- Current-format backups and saved logs reject missing measurement timestamps and unknown bodyweight units. Invalid waist records and load increments are no longer silently filtered out. Valid exports retain their records.
- Older backups with missing measurement edit timestamps use the measurement date at midnight UTC, rather than the import time. Verification and restore show migration notices. Merge keeps newer local edits; Complete restore uses the backup. These timestamps are deterministic compatibility fallbacks, not claims about when an old entry was actually edited.
- FITLOG retains version 1. A block stores one rest target per exercise or repeated-effort activity. Equivalent repeated REST lines remain accepted; conflicting values fail with a line-specific explanation. Both Coach prompt formats explain this limitation and put exceptions in NOTES. Previously saved workouts are never reparsed.
- Duplicate FITLOG preview lists all exact fingerprint matches, labels skipped history correctly, and offers Open existing. Saved plans open their preview; completed/skipped records open expanded History on the correct page; active records resume their existing editor. Intentional new copies remain available. Opening plans/history does not change training records.
- Controlled dialogs return keyboard focus to their connected opening control when available. Explicit focus handlers retain precedence.
- Monthly review has a selectable full-text fallback if clipboard copying fails. Daily/monthly lifting-volume units consistently show lb·reps or kg·reps.
- The unavailable-release page explains closing all app/Safari windows as a recovery fallback, without clearing website data, weakening release checks, or forcing an update/reload.
- Recovery-copy listings/pruning use a new small metadata store. Existing checkpoint payloads remain intact. Metadata and payload writes, pruning and erasure are atomic. A synchronous snapshot failure now explicitly aborts its transaction.
- Save status starts as Saving until the initial hydrated state has actually committed, avoiding a brief premature Saved label on first opening.
- Recovery copies are loaded when their Settings section opens. Full checkpoint payloads are loaded only for download or deliberate diagnostic bundle export.
- Daily/monthly/activity review panels defer their calculations until first opened, retaining filter choices after that. Exercise-history calculation waits for its dialog, which initially shows 30 sessions with Show 30 more.

## Compatibility and remaining limits

IndexedDB moves from version 3 to 4 solely to add checkpoint metadata. The upgrade backfills existing metadata in the upgrade transaction; it does not relocate or rewrite training records. Close other app windows if an upgrade is blocked. Keep an external backup and never clear website data to resolve an ordinary update.

Whole-log saving remains in place. The optimizations reduce known unnecessary work; they do not guarantee latency on an iPhone with thousands of sessions. Physical Safari suspension, process kills, VoiceOver, Files and update behavior require the included QC checklist. Git-history secret auditing and failed-attempt schema support are separate work, not implemented or certified by this release.
