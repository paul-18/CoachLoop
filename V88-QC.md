# v88 device QC

Back up your real log privately before updating. The synthetic backup from v87
belongs only in a disposable browser profile; do not merge it into your real log.

1. Confirm v88 after the publishing run succeeds.
2. Open Settings with completed history: no starter guide should appear at the top.
3. Switch all five tabs repeatedly; scroll History/Progress and check bottom navigation.
4. Open an older completed workout, edit a note/result, return: date and History position should remain correct.
5. Repeat an old workout: original stays intact; the new workout has targets but no completed sets.
6. Save/import a plan for later; start it, log a set, leave/resume, then finish it.
7. With an active workout, Settings should block Restart to update if an update is ready.
   Once finished and Saved, a waiting update may be applied deliberately. Check
   your log remains after reopening. Never clear storage to install an update.
8. Check portrait workout header, rotation, keyboard and fixed bottom navigation.
9. Export a full backup to Files. In a separate empty browser profile, complete
   restore and compare workouts, goals, profile, measurements and preferences.
10. In a separate empty profile, check first-use guide → profile/goals → AI brief →
    import review → log results → Finish. After completion, the guide disappears.

The automated release command also checks restore rejection, cancellation, duplicate
merge, complete restore, durable export/reopen, update save failure, active-workout
blocking and existing service-worker safety. Device checks cover what those tests
cannot reproduce.

## Reading the report

In Codespace run:

    npx --yes pnpm@11.25.0 run release:check

If any check fails, stop before committing/publishing. The report is
.release-checks/summary.md and detailed logs are beside it.
In GitHub Actions, use the QC table in the run summary or download the QC artifact.
Reports contain synthetic test output; do not put private training backups in them.
