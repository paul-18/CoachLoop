# Coach Loop v102

Baseline: v101 `fa012f0052ba20067eff70eb2f30734db396a290` on origin/main. No IndexedDB or backup-format change. Existing logs, goals, profiles, units and quick-log choices stay compatible. Demo data is still not written into the saved log.

- Finishing a workout warns when a completed activity has a distance and no time, or a pace faster than a human effort the app treats as a typing mistake (for example 203 km in 0 minutes). The message is “That distance and duration look unusual. Check your entry before saving.” Keep training to correct it, or choose Save unusual entry. The stored numbers are not changed. Swim and row distances are described in metres. Pounds and kilograms do not change the distance check. A normal run, bike, or ruck is not warned.
- History uses the same completed-set rule as the workout header and finish dialog. Skipped sets and skipped activities are left out of completed counts. An activity marked skipped says Skipped. An unfinished activity that was never skipped still says Not completed, including older records with no skipped field. One set, one planned set, and one session stay singular.
- The exercise row no longer says both “No previous result” and “Last 1”. If a recent session exists, the button says Last session or Last N sessions.
- The one-time saved-on-this-phone note still appears only after the first genuine working set or completed activity, not after a warm-up or a skip. Finish still opens History, so the same note is shown there until Got it. Dismissal is still stored on the profile, and a demo dismissal is not written to the real log.
- The first-run choices are Explore a sample log, Preview one workout, and Set up my log. The demo bar says the sample is discarded when you exit or refresh, and it no longer repeats Preview one workout. Demo data, backup locks, and the editor lease are unchanged.
- Set coaching preferences opens the coach profile and does not by itself mark that profile done. Not now hides the prompt and stays hidden after reload. Neither action fills in the profile. Not now inside demo is not saved to the real log.
- Visible ChatGPT labels now say your AI chat. Backup screens say backup file, and mention JSON only where the file format matters. The iCloud sentence also covers a non-iPhone. Strength cards say excludes bodyweight. Estimated max is described as a calculation from a recorded set, not a tested one-rep max. The strength total follows the kilogram or pound setting.
- Last 7 days hides cards that are still zero. One sentence explains what will appear. A week that has real work still shows those cards, including a kilogram strength total.
- Add training goal says it is one short goal, and the box is a short field rather than a long note.
- Goal lists use the goal text as the React key when that text is unique, so reordering does not reuse the wrong row. There is still no separate goal id in the saved log.
- The unused `starterPlanState` export is gone. Setup is still Use example goals, and the sample workout is still added only from Preview one workout. Remove starter behavior is unchanged.
- The mobility parser was not rewritten. The existing 32,000-dash regression test still applies.

Bottom navigation was not changed. At 390 px and about 500 px the stylesheet already leaves more than the floating bar’s height under Today, Settings, and Progress (Today adds extra padding). This environment had no Chromium, so that was not measured in a browser. A physical iPhone was not used.

Checks on this source are recorded in V102-QC.md. These checks do not certify a physical iPhone.
