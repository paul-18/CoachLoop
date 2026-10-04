# v89 iPhone QC

Save a private JSON backup to Files first. Confirm Settings shows v89 after the
publishing run succeeds. Do not clear website data or reinstall as a test.
Use a separate browser profile/test installation for restore/failure fixtures;
another URL query does not isolate IndexedDB.

## Main checks on your normal log

1. Open from the Home Screen in portrait and landscape. Check titles, Done,
   save status, notifications, dialogs and bottom navigation stay clear of the
   Dynamic Island/home indicator. Updates should appear only in Settings.
2. Log a small workout: actual reps/load/effort -> complete -> Done -> Finish.
   The confirmation says Saving while committing and opens History afterward.
   Close/reopen; confirm exact values/date/notes. Do not deliberately kill your
   app during Saving on real data.
3. Edit an older session. Change actuals and notes, Finish editing, then reopen.
   Its original date/completion date must remain. Repeat must create a fresh
   uncompleted workout without changing the original.
4. Expand a completed set; clear reps or enter invalid effort (e.g. RPE 999).
   It should become incomplete with guidance. Correct the value and explicitly
   complete it again. Valid reps 8, RPE 8.5 or RIR 0 should work; both effort
   scales together should not be credited. Keep your actual training accurate.
5. Open bodyweight with a known lb value. Change to kg and back: the quantity
   should convert, not stay numerically identical. 180 lb is about 81.6466 kg.
   Cancel first; then test Save with a correct real measurement and check it
   after reopening. Same-day editing must retain one entry for that date.
6. Switch Today/History/Coach/Progress/Settings after Finish, menus, note dialogs,
   import cancellation and history edits. Check keyboard-open and reduced-motion
   paths. If anything freezes, record v89/build ID, iOS version and preceding taps;
   do not guess that caching caused it or clear data.
7. Check collapsible ranked Coach goals and first-use guide behavior. Build a
   brief: ranked priorities and unknown time/equipment should be honest. If left
   open across midnight, yesterday's readiness must not carry forward.

## Backup/import checks — use disposable synthetic data

- Export JSON, save to Files, reopen it through restore and inspect the preview.
  Cancel must write nothing. Expand exact changes before applying.
- Merge an older copy into newer goals/profile/results: review which revisions
  win. Complete restore should instead match the chosen backup. Verify values
  after reopening, and check the before-restore checkpoint remains available.
- Import the *same* backup again: no duplicate IDs should appear. Different
  workout IDs sharing an old origin are intentionally kept; review the warning.
- Corrupt/truncated/newer-version or live/deleted-contradictory backups must reject
  without changing the log. Keep original questionable files for recovery.
- FITLOG: first unloaded effort followed by kg load should work. Loaded kg then
  lb in one activity should reject. WORKOUT below EXERCISE, duplicate DURATION
  and extra scalar columns should give readable line errors.
- Preview a ruck/effort plan and confirm pack load, effort load, target time,
  distance, rest and cues are visible before committing.
- Empty or warm-up-only completed lifting stays in History but adds no training
  day. A completed child effort in an unfinished activity does count once the
  session is saved. Future/skipped sessions add no current completed-training day.

## Update and failure tests — dedicated test installation

- With two consecutive deployments at the SAME test URL: download an update,
  finish training, close editors, wait for Saved, then Restart to update. Expect
  one deliberate restart and intact data. Another open window must refuse it.
- Request a restart, then background long enough to exceed the waiting timeout.
  On return, it must reconcile the requested worker, save again and restart once
  only when idle. If an editor/save is active, it should defer; Settings retains
  the restart action. No idle visit without a prior request should force reload.
- Simulated quota/transaction failure: no premature Finish success/dismissal;
  editable draft/preview remains. Retry after removing the simulated fault must
  commit before History. Automated tests cover this; do not fill or damage your
  personal phone storage to reproduce it.

Desktop/JSDOM checks cannot establish real iOS eviction, sudden process-kill
durability, lock-screen alarms, share-sheet completion or physical hit-testing.
