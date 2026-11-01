# Coach Loop v109 — update notes (draft until deployed)

Status: built locally in a clean worktree, full gate green except the
WebKit smoke stage, which cannot run on this VM (missing system
libraries) and runs in GitHub Actions CI on submission. NOT pushed.
NOT deployed. Paul submits (push to main) when he approves.

## What changes

- Circuit round stepper (spec v2 §7): a circuit activity WITH segments
  now renders rounds instead of the generic part stepper. One REPEAT
  iteration = one round, in stored order; ungrouped segments are
  single-part units. The round card shows "Round N of M" plus that
  round's stations listed compactly (plan text + labels, not forms).
  "Done: Round N" completes that round's unknown parts ONLY — other
  rounds, and skipped stations, are untouched. Round dots + "Round N
  of M" text track the current round (first round with unknown
  parts). "Done: all rounds" on the stepper completes all remaining
  rounds as prescribed, with an Undo toast like complete-all.
- Swim interval stepper (same engine): one REPEAT iteration = one
  interval set. A set card lists its intervals compactly (label +
  distance + time if given); ungrouped swim segments are individual
  interval cards. Labeled Done per set ("Done: Set N") and per
  interval ("Done: <plan>"), complete-all on the stepper ("Done: all
  sets" / "Done: all intervals"), same Undo/toast patterns.
- Show all on both steppers lists rounds/sets/units, each expandable
  to its stations, and stations keep tap-part expansion for
  duration/distance actuals (the v108 mechanism, unchanged). Group
  footers, Add part, and Repeat pattern keep working in Show all
  (they operate on parts, unchanged).
- View selection: only circuit/swim WITH segments get the grouped
  stepper. All other types keep the generic v108 stepper exactly
  as-is. Circuit/swim WITHOUT segments keep their current views
  (routine/summary) — the stepper is never forced on them, and no
  "Add parts" button is added for circuit/swim (prescriptions arrive
  via FITLOG v2 segment imports; UI part creation for circuits/swim
  is a later decision).
- New domain helpers next to the existing ones:
  `segmentUnits` (stored-order grouping) and
  `completeSegmentGroupIteration` (per-iteration completion), both
  unit-tested plus a seeded randomized invariant suite.
- v108 rules carry over unchanged: group/unit completion touches
  unknown parts only; skips never auto-complete; as-prescribed stays
  labeled as prescribed everywhere, never presented as measured;
  modified-without-actual contributes nothing for the missing
  measure; activity completion is independent of parts completion
  (final round done does not complete the activity; adding a part
  to a completed activity reopens it).

## Circuit is prescription-and-completion ONLY — stated plainly

Actual station reps/load are NOT stored. There is no station-result
model in v109, and no UI text implies station results are recorded.
If you did 12 push-ups instead of the prescribed 15, that difference
goes in the activity notes (the routine notes field is still shown
on circuit activities). The tap-part actual fields are
duration/distance only, as in v108 — that is unchanged and fine.

## AMRAP is unsupported — stated plainly

AMRAP has no fixed rounds, so the stepper cannot pre-count it.
AMRAP activities stay summary + notes. There is no AMRAP flag in the
model and nothing to detect: the stepper only renders when segments
exist, so segment-free AMRAP activities are untouched by
construction. No AMRAP handling was built.

## What does NOT change (v109 scope guardrails)

- No mobility pose cards. That decision is still Paul's (spec v2
  §11.1: add a per-move status field, or keep session cards
  permanently?). Mobility stays the v108 session card. This build
  does NOT resolve it.
- No v110: no FITLOG v3 parser, no AI prompt changes, no v1/v2
  parser edits (`app/interchange/fitlog.ts` untouched).
- No stored-field renames/deletions; evidenceVersion stays 2; no new
  stored fields in v109 (labels already exist from v108).
- No strength-logging changes; no totals/labels arithmetic changes.
- The spec file was not edited. One minor rendering note, not a
  spec change: swim distances use the shared v108 plan text, so an
  interval of 1000 m or more renders as km (e.g. "1.5 km") rather
  than metres; every typical interval distance (50–400 m) renders
  in m as specified.

## Compatibility

- Old backups import unchanged; backups still version 1 /
  evidenceVersion 2, stamped v109.
- Segment data is unchanged in shape; the grouped stepper is a view
  over the same segments the generic stepper renders.

## iPhone checks (Paul's final gate, still to do)

- Circuit round flow on a real segmented circuit: "Done: Round N"
  completes only that round, next round becomes current, skipped
  stations untouched; round Done undo via toast.
- "Done: all rounds" on a circuit; swim set flow ("Done: Set N",
  "Done: all sets") and an ungrouped swim interval card.
- Segment-free circuit still shows routine + notes (no stepper);
  segment-free swim still shows summary (no stepper); segment-free
  AMRAP-shaped circuit still summary + notes.
- v108 regressions still green on the phone: run stepper,
  complete-all, Done undo, move up/down, post-session cards, slim
  force rows, preview lines.

## Open questions carried from spec v2 §11 (for Paul, morning or later)

1. Mobility pose cards in v109: add a per-move status field, or keep
   session cards permanently? (NOT decided by this build — session
   cards stay until Paul calls it.)
2. Force: slim rows justified by his sled data; 2 routine force
   activities stay routine until an AI prescribes efforts — confirm.
3. Parts reorder: confirmed deferred.
4. Circuit station results (actual reps/load): deferred past v110;
   differences live in notes until then — confirm contentment.
5. Coach profile: hand-edit vs "Copy new profile paragraph" button
   (v110)? Button is spec'd; hand-edit works today.
6. UI part creation for circuit/swim (Add parts button, Show-all
   Add part is present but the outer entry button is not): later
   decision, as briefed.
