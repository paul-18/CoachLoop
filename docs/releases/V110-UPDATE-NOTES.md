# Coach Loop v110 — update notes (draft until deployed)

Status: built locally in a clean worktree, full gate green except the
WebKit smoke stage, which cannot run on this VM (missing system
libraries) and runs in GitHub Actions CI on submission. NOT pushed.
NOT deployed. Paul submits (push to main) when he approves.

## What changes

- FITLOG v3 parser (spec v2 §8): a new `[FITLOG:3]` envelope. The v3
  parser EXTENDS the v2 parser — one shared segmented implementation,
  not a second copy. v1 and v2 parsers are untouched legacy importers:
  old blocks import exactly as before, including segmented grappling
  and mobility blocks under v2.
- Labeled segments: SEGMENT gains an optional 5th field,
  `SEGMENT|kind|duration|distance|label`, stored in the existing
  `ActivitySegment.label` field from v108 — no new stored field, no
  evidenceVersion change, backups still version 1 / evidenceVersion 2.
  The 4-field form still parses in v3; a 6th field errors. Labels
  cannot contain `|` or newlines (a `|` in a label splits into a 6th
  field and errors with a plain message). Labels already render on
  cards, in the import preview, in coach export text, and in History
  (v108); v3 is how they arrive from the AI.
- Post-session rule, extended: the v3 parser rejects SEGMENT lines in
  yoga, grappling, soccer, and water_polo blocks with the exact
  pattern from the v108 follow-up ("<Type> is recorded after the
  session: use MODE|summary with DURATION and NOTES, not SEGMENT
  lines."), and rejects SEGMENT lines in mobility blocks ("Mobility
  uses MOVE lines, not SEGMENT lines..."). Rejection is checked
  AFTER segment re-attachment, so REPEAT-built segments in these
  types are caught too. Nothing is silently dropped. The UI
  segments-exist rule is unchanged: already-stored segmented
  activities of these types still render via the stepper; only the
  parser refuses new ones. Under v2, only yoga is rejected (as
  before); grappling, soccer, water_polo, and mobility segments
  still parse, so old v2 blocks are unaffected.
- AI prompt unification — ONE AI-facing format: `buildCoachPrompt`
  now defaults to v3 in both modes (new briefs get
  `FITLOG_V3_INSTRUCTIONS`, continuing briefs get the condensed
  `FITLOG_V3_REMINDER`). The old duplicated v1+v2 OUTPUT FORMAT
  sections are gone: the prompt contains exactly one OUTPUT FORMAT
  section and it is v3. The v3 instructions carry a per-block
  don't-miss-fields checklist (every EXERCISE needs name + SET with
  reps + load-or-blank + effort target; every CARDIO/MOBILITY needs
  TYPE + MODE + DURATION-or-segments; every MOBILITY needs a MOVE),
  the INTERVALS line scoped to SUMMARY-mode runs only ("use
  MODE|segments with REPEAT for segmented runs"), circuit rounds
  with labeled stations and kind rest for rests, swim sets with
  distances in m, AMRAP stated as having no fixed rounds (summary
  with DURATION and NOTES, never REPEAT with an invented count),
  kind other for bike/row/hike segments, and the post-session/mobility rules above. The
  v106 failure mode — under-specification that made the AI drop
  fields — is what the checklist is for.
- Coach view: the v1/v2 copy buttons are replaced by a single
  "Copy v3 format" button, plus a "Copy new profile paragraph"
  button. The paragraph is the updated format paragraph of
  `DEFAULT_COACH_PROFILE` (INTERVALS scoped to summary-mode runs,
  circuit/swim/post-session rules added); the button copies it so an
  existing stored profile can pick it up by hand. The app never
  rewrites a stored profile — changing the default changes only
  what new users start with. The coach example block is now a v3
  block with labels.
- Import dialog: the text now names the v3 envelope and notes that
  versions 1 and 2 still import. The v2 segments example button is
  unchanged (it still imports).

## Deliberately NOT in v110

- No mobility pose cards (Paul's decision still open); mobility
  stays the v108 session card.
- No segment reorder (deferred), no circuit station results
  (differences stay in notes until a later phase with a real
  station-result model), no FORCE result rows (routine force stays
  routine until the AI prescribes efforts).
- No v108/v109 stepper changes, no strength-logging changes, no
  totals/labels arithmetic changes.
- No new infrastructure, accounts, cloud sync, AI keys, or paid
  APIs. Local-first edition as-is.

## QC

- New tests: `tests/v110-fitlog.test.ts` (v3 labels incl. REPEAT
  groups, 4-field/6th-field/label-| cases, all four post-session
  rejections + mobility rejection, REPEAT-built rejection, v2
  legacy behavior incl. segmented grappling/mobility still parsing,
  v1 + v2 golden blocks, v3 example, coach-export label text, one
  OUTPUT FORMAT section in v3, profile paragraph scoping) and
  `tests/v110-journeys.test.cjs` (Coach view buttons + v3 example,
  import dialog v3 text, v3 block import end to end with labels on
  the preview group line, the round stepper card, and stored state).
- Updated tests: prompt-content tests now assert against the v3
  constants (same intent — per-side guidance, REST guidance,
  interval/mobility formats in both brief modes); release-stamp
  tests are v110-relative (future case v111, dotted case v110.2).
- Full gate: TypeScript, Lint, Tests, Production build, PWA
  generation, PWA behavior pass locally; WebKit smoke runs in CI on
  submission (VM block stated honestly, as v104–v109).

## Phone check (when Paul tests)

1. Settings shows v110.
2. Coach view: "Copy v3 format" and "Copy new profile paragraph"
   buttons present; no v1/v2 copy buttons; example block is v3.
3. Paste a v3 block with labeled circuit rounds: preview group line
   shows the station labels; round stepper shows them on the card.
4. Paste a v3 grappling/soccer/water_polo block with SEGMENT lines:
   refused with the exact post-session message, nothing imported.
5. Paste an old v1 or v2 block: imports exactly as before.
