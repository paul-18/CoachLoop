# v93 — focused iPhone checks

Before updating, finish any workout, wait for Saved, and save a JSON backup in Files. Keep it outside GitHub. After the publishing workflow succeeds, update through Settings and confirm v93. Do not clear website data or reinstall for this update.

1. **Upgrade and recovery:** close other Coach Loop windows before the first v93 opening. Confirm previous workouts, goals, profile and measurements remain. Expand Settings → Recovery copies. Download an older copy, then Verify saved backup. Confirm it contains the expected old sessions. Finish one disposable workout and confirm a new recovery copy appears.
2. **Backup round-trip:** export to Files, verify that actual file, and inspect record counts. Test restore on a separate disposable installation, not your only training log. Invalid measurement timestamps/units should show an error without changing the existing log. Legacy files may show a migration notice; review Merge versus Complete restore.
3. **Set insertion:** open a workout with a warm-up and working sets. Tap the final warm-up’s W/number menu → Insert set after. Confirm the new unfinished warm-up sits before the first working set. Edit it independently. Try Insert set before on a working set; use Mark as warm-up if needed. Reopen the app and confirm order and previous results remain. Remove an accidental new row through its existing Remove set action.
4. **FITLOG rest:** paste the synthetic block below. Review should refuse the conflicting rest values and identify REST. Change the first 60 to 180; Review should succeed. Cancel without saving.
5. **Duplicate navigation:** paste a previously imported FITLOG unchanged. Review should list existing copies. Open existing should show its saved-plan preview, history entry, or active editor. It must not create an extra workout. If a matching history entry is old, confirm it opens on its correct History page.
6. **Keyboard and copy:** with a hardware keyboard/VoiceOver if available, open Coach brief and close it. Focus should return to the opener. Open Monthly review and Copy; if copying is blocked, the full text should appear in a selectable box. Check text enlargement and the installed-app safe areas.
7. **Progress history:** select an exercise with completed results. View exercise history should still be available. With over 30 matching sessions it should show 30 and offer Show 30 more; closing/reopening resets the initial limit. Review panels should open normally after initially being collapsed.
8. **Ordinary reliability:** log a disposable actual set, Finish, immediately background and reopen. Confirm the saved results. Background during a rest timer and confirm remaining time on return. Switch all five tabs after closing dialogs.
9. **Updates:** normal Check updates/Restart to update remain in Settings. Try with a second app window open: it should ask you to close it rather than take over. If the unavailable-files page ever appears while online, follow its close-all-windows instructions. Do not deliberately remove caches or clear storage on your real log to reproduce this rare failure.

```text
[FITLOG:1]
WORKOUT|Synthetic rest QC|2026-10-05
EXERCISE|Barbell Bench Press
SET|5|100 lb total|RPE 7
REST|60
SET|5|100 lb total|RPE 8
REST|180
[/FITLOG]
```

Report failures with app version/build, iOS version, Home Screen versus Safari, the preceding taps, the save status and a screenshot. Automated tests use synthetic data and do not establish physical iPhone behavior.
