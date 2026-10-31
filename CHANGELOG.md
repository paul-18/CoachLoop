# Changelog

Release-specific design notes and QC live under [`docs/releases/`](docs/README.md). This file is the short index; it does not replace those detailed records.

## v104 — prepared candidate

- Whole-rep validation now applies to strength estimates and volume, including legacy completed records with decimal reps.
- Unusual distance/time checks include entered effort results before completion, and the unconfirmed-results prompt proceeds through the standard finish review.
- The release gate adds a mobile-sized WebKit smoke check for bottom navigation, content clearance and repeated tab switching.
- PWA and Flutter projects carry matching shared training-rule fixtures for actual reps, completing prescriptions and lifting volume.
- README, license status and release guidance are clarified. This candidate is not published until merged and deployed.

## v103

- Added warnings for implausible cardio distance/time pairs and a choice for entered results that were not marked complete.
- Rest timer Next advances past earlier unfinished blocks; warm-up labels start at W1 and working sets at Set 1.
- Clarified starter removal and the new-log quick-log defaults. Optimized handling of long FITLOG trailing separators.
- GitHub's `main` identifies itself as v103 at `c3c6002d58a674f41e5731d2b49fa7003b0fc6cf`.

## v102 and earlier

- [v102](docs/releases/V102-UPDATE-NOTES.md): activity plausibility warning, consistent completion counts, and first-run guidance.
- [v101](docs/releases/V101-UPDATE-NOTES.md): first-run demo/setup, completed counts, and quick-log defaults.
- Releases v94–v100 and earlier are indexed in the [release archive](docs/README.md).
