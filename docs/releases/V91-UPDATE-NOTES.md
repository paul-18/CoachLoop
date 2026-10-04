# v91 — Cache integrity and maintenance

Based on GitHub v90 at `301144e3ac6da95ec364ead6ac51a972d54edad4`. All 201 tracked source files matched the baseline before editing.

## Review findings addressed

- **F1, current-release files:** previous-cache responses and fetched network responses for current asset names must match the expected hash before serving. Matching previous bytes repair the current cache; old hashed filenames remain available from the retained previous release. Missing/mismatched documents receive an explicit 503 recovery page with Try again and advice not to clear storage. This never auto-reloads or activates an update.
- **F2 and microtask handoff:** drain ownership is released in the same async continuation as the final queue check. A failed drain rejects its callers and discards queued candidates, rather than later writing a Finish whose caller saw failure. Retry remains explicit/event-bounded and uses the hook's current editable state. No automatic retry loop or storage migration. Existing final-save/reset/restore protections remain.
- **Edit errors:** updater execution is inside the validation catch; a throwing/frozen-object mutation retains memory and saved data. The locked-operation message mentions saving as well as recovery. Workout inputs remain inert during final commit.
- **Update feedback:** Settings retains notices for requested/pending activation and a late failed final flush, even after the original promise has timed out. A retry still requires the exact worker, idle/visible state and a successful save. No top banner or unsolicited restart.
- **FITLOG TYPE:** omitted CARDIO TYPE is still compatible but produces a line-specific preview warning explaining the inferred type. An explicit TYPE wins without that warning. Mobility remains structured and unchanged; no existing workout is reinterpreted.
- **CSV hardening:** formula checks recognize leading ASCII control characters as well as whitespace. Actual spreadsheet application behavior still needs user verification; this is text-escaping defense, not a universal spreadsheet certification.
- **Dependencies:** twelve unused direct dependencies removed; pnpm regenerated the lockfile and a fresh frozen installation is required. Retained packages were not intentionally upgraded. Removing installed dependencies does not itself mean a smaller shipped bundle.
- **CI:** direct actions pinned to resolved commit SHAs at their existing major versions. Production Pages concurrency queues rather than cancelling an in-flight deployment; PR checks retain cancellation. The shared gate still precedes publication. Transitive actions are not all SHA-pinned by this change.
- **Maintenance:** reusable root upload procedure; per-release steps in docs/releases; ZIPs ignored and uploaded directly to Codespace; exact staging/deletion lists. Spent v83 cleanup script retired, with its historical record retained.
- **Hosting privacy:** documented same-origin storage boundaries and migration precautions. App address/database/schema are unchanged; no dedicated-domain migration or claim of origin isolation was introduced.

## Verification

Fresh pnpm 11.25.0 frozen install passed. Node 24.19.0 release gate passed TypeScript, lint, 159 tests, production build and PWA behavior. PWA identity: `3ab5082bf45e2d0a709f`. Dependency-only baseline build produced byte-identical HTML/JS/CSS; retained direct locked versions match the original. Lockfile packages fell from 455 to 395. Adapted real-hook/controller/editor failure probes retained editable failed Finish and refused failed restore preflight. Documentation links were checked. No physical iPhone session or GitHub deployment was performed here.

## Limits and product boundaries

No account/cloud/AI API/wrapper, backup nag, lazy tabs, routing rewrite, theme/layout changes, background retry loop, history rewrite or device-data reset. Timestamp timers, eight themes, coverage, Coach goals and fixed navigation remain. Original frozen-tab cause remains unproven.

Near-limit backup memory costs, installed iPhone storage/Files/VoiceOver behavior, actual shared Safari/PWA storage and the owner's other Pages sites require real-environment verification. The hosting note explains the boundary; it does not claim the risk is eliminated. Regression checks use synthetic data and simulated worker/IndexedDB behavior. Follow V91-QC.md on the device.
