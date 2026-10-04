# v89 — Restore integrity and durable saves

Based on published v88, source tree `268dbb645e9d832df4cc9c069f39ef2efd94d314`.
Every tracked source blob matched the v88 baseline before packaging.

## The seven agreed areas

1. **Backup integrity:** merging preserves distinct IDs sharing legacy provenance;
   validation rejects live/tombstone overlap at workout, exercise, activity and set
   levels; merged block order is normalized after deletion. Preview exceptions are
   displayed inside the dialog, leaving Cancel and Complete restore usable.
   Expand exact changes for result/notes/section differences and possible duplicate
   provenance. The exact reviewed candidate, including generated recovery IDs, is
   committed; a changed local base requires another review.
2. **Durable final saves:** the persistence owner now offers a locked commit
   transition. Finish, history confirmation, plan save/import, start/resume and
   discard publish success after transaction completion. Old lifecycle flushes
   cannot overtake that final write. Failure retains the editable draft or import
   preview, with retry/error feedback. Routine edits remain automatic.
3. **Bodyweight units:** switching a numeric draft converts its quantity, rather
   than merely changing its label. Four decimal places avoid material round-trip
   drift; saving the same day retains the measurement ID.
4. **Completed results:** new invalid edits become incomplete drafts; correction
   requires an explicit completion tap. Positive whole actual reps, RPE 1–10,
   RIR 0–10 and one effort scale are enforced on completion. Legacy ambiguous
   results are preserved and flagged, not silently erased or reinterpreted.
5. **Controlled updates:** capture the waiting worker after initial saving;
   recognize that exact controller; retain deliberate activation intent beyond
   timeout/background suspension; re-flush before the single visible, idle
   reload. Open editors/active workouts/focused inputs/save failure defer it.
   Pending restart remains available in Settings. Another-window denial cancels
   the request. Existing SW multi-window protection/caches are unchanged.
6. **FITLOG:** WORKOUT must appear first; fixed-field arity and duplicate activity
   scalars reject with line errors. Optional trailing SET/EFFORT columns remain
   compatible; repeated REST/NOTES remain supported. First *loaded* effort sets
   its unit even after unloaded efforts; truly mixed loaded units reject. Preview
   shows pack load and effort rest as well as already-shown targets and cues.
7. **Evidence summaries:** shared predicates distinguish working strength,
   completed activities/child efforts and HYROX splits. Empty and warm-up-only
   lifting do not count in streaks/weekly training totals/calendar strength markers.
   Original sessions remain in History/backups; AI exports label sessions without
   working evidence. Coach priorities are numbered; unknown time/equipment stay
   unspecified; an open brief refreshes at the local-day boundary and clears stale
   readiness.

The v88 shell split, guide behavior, collapsible Coach goals, eight themes,
safe-area layout, bottom navigation and local-only boundary are retained.
The workout save cue shares its existing header line to avoid increasing the
fixed header height on small installed iPhone screens.

## Verification and limits

See the delivered Check Results report and V89-QC.md. New tests cover the audit's
reproduced merges, contradictory backups, exact reviewed recovery IDs/stale
preview refusal, invalid completed edits, actual bodyweight UI conversion,
aborted/delayed Finish, FITLOG grammar/units and delayed worker activation.
React DOM/fake IndexedDB and worker tests do not prove physical Safari behavior.
No real user database was modified. No actual iPhone update was performed here.

The reported frozen-tab cause remains unproven. No speculative routing rewrite,
storage reset, automatic chunk-failure reload, lock stealing or lazy chunks were
added. Tabs remain eagerly bundled; the existing bundle-size warning remains.

## Deliberately deferred or declined

- Updates stay in Settings; no top-of-page update action or persistent backup nag.
- Timestamp rest timer stays intact. No account/cloud/AI API or App Store wrapper.
- Incremental storage, duplicate full-log validation/per-edit latency, snapshot
  metadata optimization and further editor decomposition need separate measured
  work. This release does not claim those performance costs are solved.
- Failed-attempt schema, open-existing duplicate-import UX and user-invoked backup
  verification remain product follow-ups. Exact reimports still warn and may be
  deliberately accepted as a second copy.
- The audit's dependency-advisory/CSP suggestions and exhaustive history-secret,
  accessibility and physical-device audits are separate follow-ups, not certified
  complete by this patch. No dependencies, lockfile or production CSP changed.
- Manual restore still uses newest revisions for shared IDs/whole sections; exact
  preview makes changes visible, but it is not automatic conflict-free multi-device
  sync. Backup format stays v1 / evidence v2; no database migration was introduced.
