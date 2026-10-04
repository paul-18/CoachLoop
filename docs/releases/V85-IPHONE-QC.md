# v85 iPhone QC

Back up your real log privately first. The first three checks are safe on your
normal app. For restores, failure injection or deliberately damaged data, use a
separate test installation with isolated storage and synthetic data. A second
tab at the same app URL is NOT isolated. Do not publish private backup files.

## 1. Main priority: header rotation

Open from the Home Screen icon, not just a Safari tab.

1. Start a synthetic workout; check title, Done and options below the Dynamic Island.
2. Start a rest timer. Rotate portrait -> landscape -> portrait several times.
3. Also try opening the workout while already in landscape, then rotate to portrait.
4. Scroll, open the keyboard for a weight/reps field, dismiss it, rotate again.
5. Check there is no header/control clipping, overlap with the timer, growing gap or hidden first exercise. Check Save-error/update notifications if they occur naturally.

Expected: header follows the safe area; rest timer and content follow the actual
header height. Landscape may have different spacing. Automated DOM tests cannot
prove the physical layout.

## 2. Existing-data upgrade and offline reopening

1. Before updating, verify an existing saved result, a goal and your coach profile.
2. Finish active training and wait for Saved.
3. Settings -> Check updates -> Restart to update. Confirm v85.
4. Verify the same result, goal and profile. Themes and shortcut order must remain.
5. With internet available, wait for offline readiness. Close the app, enable Airplane Mode, reopen and visit all tabs.
6. Log a synthetic set offline, close/reopen, verify it remains, then return online.

Expected: one deliberate restart, no missing tabs/data and no forced reload
during logging. If another window blocks updating, close it and retry. Never
clear site data as the update procedure.

## 3. Backup download/share

1. Download a full backup to Files. Confirm it exists and has a plausible size.
2. Use Share backup / Save to Files too; cancel once, then save successfully.
3. On an isolated synthetic log, preview restore with Merge and Complete restore.
4. Complete restore should reproduce the backup's goals, coach profile, theme,
   measurements and workouts; Merge should retain newer local revisions.
5. Optionally test a synthetic >10 MB backup: it should work up to 50 MB, allowing
   time for phone processing. Above 50 MB is explicitly unsupported and must
   fail without changing the current log.

## 4. Multiple unfinished workouts (isolated synthetic data only)

Create a synthetic workout A and export its backup. On a separate isolated log,
create a differently named workout B and export. Restore both with Merge into
the test log; confirm the unfinished-session chooser appears.

1. Resume A, log a set, finish it, wait for Saved.
2. Return to Today: B must remain resumable.
3. Close/reopen the test app: B must still be resumable.
4. Discard B with confirmation, then start another blank workout successfully.
5. Repeat, but discard A first. B must still be reachable.

Do not merge these synthetic fixtures into your real log.

## 5. Coverage explanations and day change

On a synthetic log, alias a nickname to Bench press and log one completed
non-warm-up set. Chest coverage should count it, and its source explanation
should show that exact exercise. Warm-ups should not add credit.

For the day boundary, log a result dated six days ago, leave Progress open,
background it overnight and return after local midnight. That old result should
leave the seven-day totals and explanation together. You can test fixed dates
in automated tests instead; do not change the clock on your main phone.

## Advanced checks (developer/test installation only)

- Cache repair: delete Cache Storage's entry document but NOT IndexedDB or its
  registration. Reopen online, then offline: the entry should have been repaired
  if that release is still hosted. Old workers must not cache a new deployment's
  document. If old files are no longer hosted, use the deliberate update flow.
- Recovery: corrupt only the synthetic saved state while retaining a known-good
  snapshot. The error screen should let you download a complete diagnostic
  bundle AND an individual checkpoint. Restore the individual checkpoint on a
  working test installation and verify profile/goals/results. The bundle is not
  a direct-restore backup. Never attempt this on your real log.
- Save failure: inject a quota/write failure. The unsaved warning must appear;
  entered work should remain visible, updates must stay blocked, and retry must
  persist it after the failure is removed.

Report app version, iPhone/iOS version, Home Screen vs Safari, orientation,
exact steps and a screenshot with private information hidden. Do not attach
personal training backups to public issues.
