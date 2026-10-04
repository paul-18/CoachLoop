# Coach Loop v80 — iPhone QC

Back up your real log to Files before publishing or testing. Do not put that JSON in public GitHub or bug reports. Keep the same installed app address. Test destructive cases in a disposable browser/profile or a separate test deployment; separate browser storage does not share the real log. A second tab at the same address is not a disposable database.

## First verify the upgrade

Finish any workout, wait for saving, close all old Coach Loop windows and reopen online. Check the status row shows **v80 · a build identifier**, **Check updates**, and **Saved on this device**. Settings should have **Share backup / Save to Files**, persistence diagnostics and the expanded restore preview. Old editions cannot display the newly added update controls, so the first upgrade can still require closing/reopening after downloading.

## Highest-value checks

| Test and how to recreate it | Expected result |
| --- | --- |
| Tap Today → History → Coach → Progress → Settings → Today ten times. Open a profile editor, cancel/save, visit a workout and go back. | Each screen opens promptly; no permanent Opening view, frozen tab or restart requirement. Coach keeps ranked goals. |
| Wait for Offline ready, enable Airplane Mode, close/reopen the installed app and repeat every tab. Log a small synthetic workout and reopen. | Cached screens open offline and saved evidence survives. A very first visit without previously cached files cannot work offline. |
| Start a synthetic workout, enter a set, immediately switch apps or lock the phone; return and inspect the set. | The last valid edit survives and save status settles. If saving fails, an explicit warning remains; it never falsely says Saved. Very abrupt OS termination before storage commits is not guaranteed. |
| Open the same address in Safari and the Home Screen app. While one owns the editor, visit the other; close the owner and retry/return. | The other window explains the writer lock and offers saved-log export. It acquires ownership after release without repeated page reloads. It must not allow competing writes or forcibly take over. iOS may retain a suspended owner until that window closes. |
| Begin a 60-second rest, background the app for 30 seconds, then return; repeat after more than 60 seconds. | Remaining time reflects elapsed wall time, never restarting at 60. Wake lock is re-requested when visible if enabled/supported. iPhone battery/OS may still release or deny it. |
| On a small iPhone, edit long profile/goals text with the keyboard open. Try set completion, reorder arrows, trend points, dialogs and bottom navigation one-handed. | Save/Cancel remain reachable, inputs don't zoom, controls are tappable, content clears safe areas. Try large text and VoiceOver as well. |
| Choose all four themes, female/male coverage, one Last 7 days card, reordered Water polo shortcuts, then hide every Progress section. Reopen and export/restore on a test browser. | Choices persist, restored choices match, Modify Progress remains reachable, Coach goals remain visible. Water polo stays Water polo in a circuit and in history. |

## Evidence, dates and imports

1. **Plan versus result:** prescribe a 60-minute run but log 30 minutes and a different distance. Finish it. History, coach text and CSV must report the actual result; the prescription may be shown only as a labeled target.
2. **Partial repeated activity:** create two effort segments; complete only the first. Exports/totals must count only completed effort evidence, label the unfinished segment and not duplicate the completed segment. Skip another activity with a reason; check the CSV reason lands in Notes.
3. **Warm-ups and estimates:** complete one warm-up and one working strength set. Warm-up stays visible in the log and CSV Warm-up column but does not contribute to working-set totals/PRs/strength progression. A one-rep single uses its exact load; sets above 10 reps have no Epley estimate. Compare weighted, assisted and strict bodyweight pull-ups: they must not be mixed in strict bodyweight strength comparisons.
4. **Units and hints:** log 100 kg, then use lb for a later matching exercise/protocol. Previous-set hints should convert units. Switch to a different load protocol: an incompatible hint should not be offered. RIR should appear in hints when recorded.
5. **Old dates:** edit a completed workout from last month, alter a note/set and save. The workout stays on that date. A backdated correction must not become the latest training day solely because it was edited today. Starting a saved plan intentionally assigns today; use its date editor for a different day.
6. **FITLOG strictness:** use Copy format for a valid block. Change a SET rep target to `banana`, `0` or `8-6`, or an explicit TYPE to `brunch`. Import must reject it with a useful message before changing the log. A valid `6-8` plan is allowed, but completion requires your actual whole-number reps. Preview shows warm-up and RPE/RIR. Duplicate import warns. Save an unstarted plan and use Undo last import; it must remove only that plan. Undo is intentionally not offered after starting/logging it or after relaunch.
7. **Midnight:** leave Today/Progress open across local midnight, then foreground the app. Date-dependent cards refresh. For an advanced test use a spare device around a DST change; old workout calendar dates must stay unchanged. Date picker displays the chosen local day.
8. **Long session/history:** use a synthetic multi-hour workout with many sets and a large imported historical test log. Check typing, saving, history and Progress remain usable. Whole-log validation still scales with history; report noticeable delays rather than assuming automated tests prove performance.

## Backup safety — use synthetic data

- Download JSON, then **Share backup / Save to Files**. Open Files and verify the JSON actually exists and is non-empty. Cancel the share sheet: it should not claim a successful external backup. Open the downloaded JSON in a spare browser and restore it; check goals, measurements, preferences and evidence.
- Restore the same backup twice: ordinary merge should not duplicate workouts. Change an existing result and inspect the preview: it includes existing-workout and other-section changes. A newer benchmark attempt should not be overwritten by an older backup.
- Delete a synthetic workout, then restore its older backup normally: the deletion remains. Restore with **Recover deleted records with new IDs**: the workout returns under a fresh ID without removing the deletion protection. Repeat with a deleted set. Fresh-ID recovery can intentionally create another copy if repeated: review the preview.
- Make disposable copies of a synthetic backup and (a) truncate the JSON, (b) set `evidenceVersion` to `999`, (c) duplicate a workout ID, (d) enter a negative measurement, (e) replace a timestamp with `not-a-date`. Each must be rejected before restore. The existing saved log must stay unchanged. A file over 10 MB must be rejected before reading/parsing it.
- **Erase only in a disposable profile:** export first, then erase. Its warning says local recovery copies are also erased. On success the synthetic log and copies disappear. This cannot recover a real erased log without its external backup.
- Quota/write/erase failure rollback is covered by automated fake-IndexedDB tests. Do not fill your actual iPhone storage to recreate it. Real Safari quota behavior remains a device-test limitation; if a save error occurs naturally, export immediately and keep website data intact.

## One-restart updates — requires two actual deployments

This test needs the fixed release already installed, then a later changed build deployed to the same test URL. Re-running an identical build need not create a new update. The first old-to-new installation cannot test controls absent in the old release.

1. Keep the fixed app open, record its build identifier, and deploy a changed build. Return online and tap Check updates. Wait for Restart to update.
2. With an active workout/editor, it must be disabled; normal logging continues. Finish/cancel the synthetic session, close the editor and wait for Saved.
3. Keep a second same-address window open and attempt the update. It should request closing that window, with no reload or data loss.
4. Close the other window, tap Restart to update. Exactly one intentional restart should load the new build identifier and preserve the saved log/settings. Going back offline should still open every screen.
5. If iOS activation fails, the app should show an error and return to usable controls; close all Coach Loop windows/reopen as the fallback. Never clear website data to fix an update.

Advanced desktop cache test: in DevTools, delete just one cached app asset or index response while online, then reload. The worker should repair the missing file from the network. Do not delete IndexedDB. With a required file missing and the network off, successful cold startup is impossible; restoring connectivity should repair it without erasing the log. This path is also checked by the worker harness.

## Reporting a failure

Record device/iOS/browser version, Safari tab versus installed app, build identifier, online/offline state, exact taps, visible save/offline/update state and whether a second window was open. A redacted screen recording is useful. Do not attach personal JSON backups. Safari Web Inspector on a Mac can capture console, network and service-worker errors if available.

Automated checks cover real React DOM tab switching, strict validation, failed restore/save/erase, worker cache misses/offline/update messages, timestamps and workout evidence. They do not replace physical iPhone, screen-reader, Safari share-sheet or two-deployment testing.
