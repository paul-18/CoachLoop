# Coach Loop v108 — update notes (built, NOT submitted)

Status: built locally in a clean worktree, full gate green except the
WebKit smoke stage, which cannot run on this VM (missing system
libraries) and runs in GitHub Actions CI on submission. NOT pushed.
NOT deployed. Paul submits (push to main) when he approves.

## What changes

- Segmented run/walk/hike/ruck/bike/row activities use a stepper:
  current card, "Part N of M" text, progress dots, Show all compact
  cards, labeled "Done: <plan>" buttons, one expanded part at a time,
  "Complete all remaining as prescribed" on the stepper, Undo for
  every Done tap (toast + Undo confirmation button).
- "Edit detail" is deleted. Add part and Repeat pattern moved to the
  Show-all footer (v107 repeat guard kept). Remove keeps its Undo
  toast. Group completion lives in Show-all only.
- Post-session cards for yoga, grappling, soccer, water polo:
  duration + visible notes + labeled Done, only when no segments
  exist. If segments exist, the stepper always shows.
- Mobility session card: moves read-only + duration + visible notes
  + labeled Done. (Pose cards are v109 with the move-status decision.)
- Force effort rows slimmed: plan as text + labeled check +
  "Did different" behind a tap. Prescription stays behind
  "Edit prescription".
- Import preview: one line per part, one collapsed line per repeat
  group ("Repeat 6x: Run 4 min + Walk 1 min"), labels shown.
- Move up/down for exercises and activities via blockOrder, disabled
  at the ends, toasts "Moved up"/"Moved down". "Do later · move to
  bottom" unchanged.
- Optional segment label (UI edit only in v108; no FITLOG v3 parser).
  Labels reject | and newlines with a plain message. Labels render in
  cards, preview, coach export, and History.
- Activity completion is independent of parts: final part done does
  not complete the activity; all-skipped is not complete; adding a
  part to a completed activity reopens it. As-prescribed stays labeled
  as prescribed everywhere; modified-without-actual contributes
  nothing for the missing measure; skips never auto-complete.

## What does NOT change (v108 scope guardrails)

- No circuit stepper, swim stepper, or mobility pose cards (v109).
- No FITLOG v3 parser, no AI prompt changes, no v1/v2 parser edits.
- No stored-field renames/deletions; evidenceVersion stays 2.
- No strength-logging changes; no totals/labels arithmetic changes.
- The only data addition is optional ActivitySegment.label.

## Compatibility

- Old backups (no labels) import unchanged.
- v108 labeled backups import in v105 verbatim: v105's activity
  schema is passthrough and its loader spreads whole activities, so
  segments and labels survive opaquely (v105 has no segment UI, so
  they are inert there). Correction to the brief's wording: labels are
  preserved, not stripped — verified from v105's source (read-only).
- Backups still version 1 / evidenceVersion 2, stamped v108.

## iPhone checks (Paul's final gate, still to do)

- Current-card flow on a real run; complete-all (2 taps for a
  post-session 13-part log); Done undo; move up/down in a mixed
  workout; preview lines; post-session yoga/grappling cards; slim
  force rows; "Edit detail" gone; summary runs as quick as before.

## Open questions carried from spec v2 §11 (for Paul, morning or later)

1. Mobility pose cards in v109: add a per-move status field, or keep
   session cards permanently?
2. Force: slim rows justified by his sled data; 2 routine force
   activities stay routine until an AI prescribes efforts — confirm.
3. Parts reorder: confirmed deferred.
4. Circuit station results (actual reps/load): deferred past v110;
   differences live in notes until then — confirm contentment.
5. Coach profile: hand-edit vs "Copy new profile paragraph" button
   (v110)? Button is spec'd; hand-edit works today.
