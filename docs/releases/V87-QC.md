# v87 QC

## New user (use a separate empty browser profile)

1. Open Today with an empty log: guide appears, no overdue bodyweight message.
2. Set profile from the guide, save it, return: profile shows Added.
3. Add goals from the guide. Expand Example goals, try one, Cancel: no goal added.
4. Try again, edit to your own target, Save. Add a second; first remains intact.
5. Reorder goals. Coach → Your priorities should show the same order, collapsed initially.
6. Build a new-chat brief. Check it includes your profile and ranked goals.
7. Try example import: cancel preview and check no workout/history was added.
8. Import a suitable FITLOG, save it for later: it is a plan, not completed history.
9. Start it, enter actual results, complete sets, Done → Finish workout. Verify History/Progress.
10. Reopen Settings: collapsed coaching guide remains available after completion.

## Your installed iPhone app

- Keep a private JSON backup. Never use your real log for synthetic tests.
- Verify v87, portrait safe area, fixed bottom navigation, editor with keyboard open,
  goal Save/Cancel, return from background, offline logging and Saved status.
- Verify Share backup / Save to Files actually creates a readable JSON file.
- Recheck after a complete close/reopen; goals/profile/results should remain.

## Large-history test (disposable browser profile only)

CoachLoop-SYNTHETIC-1000-workouts.json is TEST DATA, not your backup or a training plan.
Do NOT merge it into normal Safari or Home Screen storage. A query-string URL is
not isolated storage. Use a separate browser profile with no real Coach Loop data.

Generate it from source:

    node --import tsx scripts/generate-qc-history.ts /tmp/CoachLoop-SYNTHETIC-1000-workouts.json

Settings → Restore JSON backup → review 1,000 additions → Merge backup.
Test all five tabs, History search "SYNTHETIC QC 1 —", expand oldest workout,
clear search, scroll history, Progress/exercise trends, then close/reopen.
Download a full backup and restore it into ANOTHER empty profile; check 1,000
workouts, both synthetic goals and the synthetic profile remain.

Already checked on live v86: restore preview/commit, five tabs, oldest session,
Progress rendering, goals and relaunch retention. No console warnings/errors.
Live export-file capture was unavailable, so that browser round trip is outstanding.
Local backup serialization/parsing retained every workout/set.

## Follow-up priorities

- Measure set-save responsiveness on a real iPhone with several years of history.
- If slow, reduce full-log validation/write work per edit and paginate long histories.
- Split additional shell responsibilities when doing related work, with regression tests.
  Source-file splitting alone will not reduce the downloaded bundle.
