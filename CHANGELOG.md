# Changelog

Release-specific design notes and QC live under [`docs/releases/`](docs/README.md). This file is the short index; it does not replace those detailed records.

## v105 — prepared candidate

- Finish review edits now stay on the candidate workout, and choosing to mark typed activity results complete does not alter the draft until Save. Cancelling the review discards that candidate cleanly.
- The unfinished-work detail list now uses the same open-activity rule as its count. A DOM regression covers cancel/retry, session effort and notes retention, and a 10 km / 19 min warning requiring explicit confirmation.
- Saved-workout toast and Progress empty-state wording now match the action and control labels.
- Release records document the v104 upload recovery and the v104 second-review data-loss finding and correction.

## v104 — published

- Whole-rep validation now applies to strength estimates and volume, including legacy completed records with decimal reps.
- Unusual distance/time checks include entered effort results before completion, and the unconfirmed-results prompt proceeds through the standard finish review.
- The release gate adds a mobile-sized WebKit smoke check for bottom navigation, content clearance and repeated tab switching.
- PWA and Flutter projects carry matching shared training-rule fixtures for actual reps, completing prescriptions and lifting volume.
- README, license status and release guidance are clarified. Published to GitHub Pages from `main` at `6fb1537a0c9e575b09c2b07b08937afe52d510d1` after the release gate passed.

## v103

- Added warnings for implausible cardio distance/time pairs and a choice for entered results that were not marked complete.
- Rest timer Next advances past earlier unfinished blocks; warm-up labels start at W1 and working sets at Set 1.
- Clarified starter removal and the new-log quick-log defaults. Optimized handling of long FITLOG trailing separators.
- GitHub's `main` identifies itself as v103 at `c3c6002d58a674f41e5731d2b49fa7003b0fc6cf`.

## v102 and earlier

- [v102](docs/releases/V102-UPDATE-NOTES.md): activity plausibility warning, consistent completion counts, and first-run guidance.
- [v101](docs/releases/V101-UPDATE-NOTES.md): first-run demo/setup, completed counts, and quick-log defaults.
- Releases v94–v100 and earlier are indexed in the [release archive](docs/README.md).
