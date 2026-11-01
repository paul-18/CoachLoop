# Coach Loop v108 — follow-up update notes (phone layout fixes, same version stamp)

Status: published from main at `f019ab1`; Pages run #64 passed
(including the WebKit gate CI runs) and deployed; live sw.js digest
`cbd231b74b335090466a` (Settings suffix `cbd231b7`).

## What changes

- Stepper layout rules added in `app/globals.css`. v108 shipped the
  stepper's custom classes with no CSS rules, so phones rendered
  browser-default inline content: plan and intensity glued together
  ("Run 4 minEasy conversational effort"), invisible progress dots,
  colliding Show-all rows. The current-part card is now a bordered
  block: plan on its own line, intensity on its own quiet second
  line, labeled `Done: <plan>` kept, dots visible (done = lime,
  measured = blue, skipped = outlined, current = ringed).
- Show-all: every part is its own grid row (tappable text line +
  nowrap status + its own 44px Done button); group rows and repeat
  controls wrap instead of colliding. Expanded part forms got grid
  layout too.
- Import preview: Category no longer shares a `justify-between` row
  with the name and is no longer capped at `max-w-36`. Name on its
  own line, Category on its own full-width row under it (44px tall)
  for every block.
- Effort rows: plan appears exactly once per row, inside the Done
  button. Completed state keeps the same button, same text, same
  slot, with the checkmark added in place — no layout shift, plan
  never disappears. `Did different` sits beside it; expanded actuals
  span the full row. (Cause: display rows reused a 5-column grid
  built for prescription rows, but a display row has only 4
  children.)
- Distance/spacing: display strings are byte-identical to v108
  (same ` · ` separators and units); spacing is fixed by layout
  (full-width plan lines, real gaps, `text-wrap: pretty`).
- FITLOG v2 parser: a yoga block with SEGMENT lines now fails
  import with `Yoga is recorded after the session: use MODE|summary
  with DURATION and NOTES, not SEGMENT lines.` Nothing is silently
  dropped, including REPEAT-built segments. One line added to
  `FITLOG_V2_INSTRUCTIONS` only. Grappling, soccer, water polo
  untouched. Already-stored segmented yoga still renders via the
  stepper (UI segments-exist rule unchanged).
- Backup "newer release" comparison now understands dotted versions:
  `releaseNumber` accepts `v108.1`, `v108.2`, etc., so the warning
  fires correctly across patch releases.
- `APP_RELEASE` stays `v108` (same version stamp, new build). No evidenceVersion, stored-field,
  strength, totals, or moveBlock changes. No circuit round buttons
  (v109's territory).

## QC

- Gate: TypeScript, Lint, Tests, Production build, PWA generation,
  PWA behavior green; WebKit smoke cannot run on this VM (see
  Status). Tests: 326 carried over + new stamp/regex
  coverage in `release-journeys` and `v106-phase0`.
- iPhone checklist (for after deployment): current-part card
  plan/intensity separation; visible dots; Show-all rows readable;
  preview Category full-width every block; sled effort rows plan
  once + checkmark in place; `Did different` per effort only;
  segmented yoga import refused with the exact message; summary
  yoga/grappling/soccer/circuit views unchanged apart from
  tidiness; summary runs as quick as before.
