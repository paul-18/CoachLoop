# Coach Loop v82 — portrait PWA priority QC

Make a private external JSON backup before updating. Use the same installed address. Never clear Safari website data to refresh an app.

1. **Verify release first:** Settings footer must show v82. Existing v81 uses Settings → On this device → Check updates → Restart to update after the log saves and workouts/editors close. Close other app windows if requested. If activation fails, close all Coach Loop Safari/Home Screen windows and reopen online; don't delete/reinstall or clear data.
2. **Portrait Dynamic Island:** cold-open the installed app, then visit every tab at the top. No heading/control should sit underneath the island/status bar. Scroll and bounce-scroll to the top. A dark backing strip protects the status area; extra space on a non-notched installed phone is intentional. Safari tabs should not get the installed-only minimum padding.
3. **Notifications/updates:** tap Check updates. Its confirmation should appear directly below the Settings controls. Trigger a Copy or export notification elsewhere: the toast must be below the island. Check any long/error notification and its close button. Desktop and mobile toast layers both reserve the safe top. A requested check does not mean a waiting release has already finished installing.
4. **Workout/rest and Hyrox:** open a synthetic workout, start a rest timer and scroll. Back/finish buttons and title must stay below the island, with the rest timer below the header and content below both. Check Hyrox setup and controls too. Rotate portrait → landscape → portrait, both immediately after launch and while a timer is active. Landscape should not retain the 56 px portrait minimum; side notch clearance should remain.
5. **Dialogs/keyboard:** open profile/goal editing, backup restore, import preview and workout date. Try long content and larger system text; top/close controls must stay reachable, content should scroll above the bottom safe area. Open/close the keyboard and rotate. Test with VoiceOver if available. DOM checks cannot establish actual notch/keyboard geometry.
6. **Body map/all themes:** female hair, head and neck must remain dark neutral in Lime, Peach, Sky Blue and Soft Violet, including front/back. Coverage progresses dark grey → mid grey → near-white in five distinct set-credit ranges. Legend swatches and totals should match; selected-region outline may use the theme accent. More coverage means more completed working-set credit, not higher RPE.
7. **Coach priorities:** default collapsed, showing goal count. Tap/keyboard-open to see every ranked goal, including long multiline text; close again. Edit goals and verify the brief still includes them. No goals are deleted or truncated.
8. **Regression:** check shortcut reorder, merge/complete restore with synthetic data, offline navigation, background-saving and elapsed rest time. These v81/v80 behaviours should remain unchanged.

For any remaining overlap, report iPhone/iOS, v82 build identifier, installed PWA vs Safari, portrait/landscape, cold launch vs rotation, exact screen/action and a redacted screenshot. Don't attach personal JSON backups publicly.

113 tests, typecheck, lint, build and worker checks pass. Actual physical PWA safe-area layout remains your highest-priority validation.

Revised v82: the workout save-failure warning is also safe-area aware. Its placement/retry callback is regression-tested. Do not fill your real phone storage to induce quota failure; use a disposable test browser if deliberately simulating a failed write.
