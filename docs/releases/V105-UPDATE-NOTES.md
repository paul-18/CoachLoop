# Coach Loop v105

Baseline: published v104 at `6fb1537a0c9e575b09c2b07b08937afe52d510d1`. Published to GitHub Pages at `b8f169139f09e412872f65e70126197382c2c9ac`; Pages workflow run #56 passed the release gate and deployed. No IndexedDB, training-data, FITLOG or backup-format migration was introduced.

- Session effort and notes edited in the second finish review are now saved with the reviewed workout candidate.
- Marking entered activity results complete remains provisional until Save. Keeping training cancels the review without changing the workout or its activity completion state.
- The unfinished-activity detail list and its count now use the same rule.
- New workout saves say “Workout saved”; the empty Progress message names “Modify Progress.”
- Added a rendered workflow regression covering cancellation, retry, effort/note retention and an unusual 10 km / 19 min result that requires explicit confirmation.

## Incident record

During the v104 upload, the GitHub file-transfer process truncated `pnpm-lock.yaml` and `app/views/workout-editor.tsx`. GitHub Actions rejected those commits before production deployment, so the live PWA remained on v103 during recovery. The complete files were restored, all 25 changed files were checked byte-for-byte against the intended local tree, and GitHub Actions run #55 passed before v104 was deployed. No deployed build or stored workout data was changed by that failed upload. A separate v104 defect then allowed the second finish review to save candidate activity completion while dropping session effort and notes typed in that review; v105 keeps those edits on the candidate and adds an integration regression for the full flow.

The release gate passed locally and in GitHub Actions. Focused physical iPhone QC is still a device-side follow-up; the automated WebKit check is not a substitute for native Safari and Home Screen testing.
