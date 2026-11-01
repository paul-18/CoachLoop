# Coach Loop v104

Baseline: v103 at `c3c6002d58a674f41e5731d2b49fa7003b0fc6cf`. Published to GitHub Pages from `main` at `6fb1537a0c9e575b09c2b07b08937afe52d510d1`. No IndexedDB, training-data, FITLOG or backup-format migration was introduced.

- Actual strength reps are consistently validated as positive whole numbers in evidence checks, strength estimates and lifting volume. Existing malformed legacy values remain visible but do not contribute fractional-rep calculations.
- Distance/time plausibility checks inspect individually entered effort results even before those efforts are marked complete. The unconfirmed-actuals choices now continue into the normal finish review, which shows the warning and requires the explicit **Save unusual entry** action when applicable.
- The release gate includes Playwright WebKit at an iPhone-sized viewport. It checks the mobile tab bar stays in bounds, Today content has room below it, the page has no horizontal overflow, and all tabs switch repeatedly without page errors.
- PWA and Flutter projects use byte-identical shared training-rule fixture vectors for rep parsing, completing fixed/range prescriptions, and warm-up/per-hand/legacy volume rules.
- FITLOG regression coverage already exists for malformed fields and extra surrounding prose. The new shared rules fixture is not a collection of user-supplied AI failures; anonymized real failure examples can be added when available.
- README, release archive, release guidance and license status are updated.

The release gate passed in GitHub Actions (run #55), including TypeScript, lint, tests, production build, PWA checks and mobile-sized WebKit smoke. Focused physical iPhone QC remains a device-side check.
