# Coach Loop v86 — clearer unilateral FITLOG guidance

Prepared against v85 at GitHub commit `c57411004384591151d9539e2fa2970ea4568b5c`.

- Full FITLOG instructions explicitly require numeric-only reps, show the invalid `10 each side` form, and provide a valid Pallof Press example with per-side guidance in NOTES.
- Continuing-chat reminders now include the same rule, so this guidance is not limited to a new AI chat or Copy format.
- Numeric targets represent reps per side for this convention. The app does not automatically double those reps in volume calculations.
- README and release label updated.
- Parser, stored workouts, navigation, calculations and dependencies unchanged. No migration or reset is needed.

Verification: 125 tests, TypeScript, ESLint, production build and PWA checks passed. New regressions cover importing the example, rejecting annotated reps, and including guidance in both brief modes without mutating the log.

After publishing, check Settings shows v86. Coach -> Copy format should include
the new example. Build a new-chat AND continuing-chat brief; both should mention
numeric-only reps and per-side NOTES. Paste the fresh guidance into an existing
AI conversation before asking for its next workout: old copied prompts do not
update themselves. An AI can still ignore instructions, so review its FITLOG.

The bottom-bar issue resolved after restarting. No speculative navigation change
is included. Report exact reproduction steps if it returns.
