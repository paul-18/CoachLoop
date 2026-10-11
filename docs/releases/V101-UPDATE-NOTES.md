# Coach Loop v101

Baseline: v100 `3fa13a2e8f7769f8248aae0fba22b38f9efb86f1` on origin/main. No IndexedDB or backup-format change. Existing logs, goals, profiles, units and quick-log choices stay compatible. Demo data is not written into that log.

- The workout header and the finish dialog now use the same counts: sets, efforts and activities, with skipped work left out. History counts an exercise only when it has a completed set, and says “1 session” or “1 set” when there is one.
- Skipping an activity keeps it out of the rest timer’s Next line. Skip activity is in the activity menu.
- Ticking a set without typing still logs the suggested reps and load. The set row says Suggested while that completed-as-planned flag is set. History does not use that word: the same flag also means an ordinary accepted prescription, and the log does not store whether the athlete typed the numbers.
- The one-time saved-on-this-phone note appears for a starter or a blank log after a real working set or a completed activity. A warm-up checkbox alone does not show it. Got it still hides it for good.
- Starter goals is the heading only while those exact starter goals are still there. Your own goals say Your goals. A kilogram log gets Bench press 100 kg and a practical kg sample (20, 60, 70, 75, 80, then 85 kg, and 4 kg dumbbells per hand). Pounds stay 225 lb and the existing pound loads.
- Remove starter asks first. It still deletes only the untouched Starter session, and clears starter goals or the starter profile only if they were not edited. A quick-log list you changed is kept. An untouched new log keeps the four starter buttons rather than switching on every activity.
- While the welcome screen is up, Import workout, Ask ChatGPT and Blank workout stay hidden. Restore backup stays a quiet link. The screen says the app has no AI of its own. Explore demo is a separate sample, not another copy of the starter.
- The welcome screen explains that Coach Loop is a private log, with no account and no AI inside the app, before the starting choices. Start blank can be undone with Back until a workout, goal, or profile is added. A changed quick-log list is kept.
- The Starter session is explained on Today: it is a plan, not a finished workout. Preview it, then start it. While the coach profile is still the starter text, or a blank log has none, Today offers Set coaching preferences.
- Last 7 days no longer shows water polo unless that card is chosen in Settings. Logged water-polo sessions stay in History.
- Today has more room above the bottom bar at phone width. The shared tab bar was not changed.
- Explore demo builds a new in-memory log each time it is opened. The dates are the previous 14 days, with rest days, easy and longer runs, a tempo run, a ruck, recovery mobility, and several strength sessions. Progress coverage comes from those completed sets and the app’s own exercise-name rules. It is not written to the saved log. Backup, restore, export, copy, delete, and erase stay off. Exit or refresh returns to the real log.
- See a sample workout lists one example plan, including the short bike block, without opening it as a workout to fill in. It is not completed and it is not stored unless you choose Add this plan to my log. Use example goals adds goals and a coach profile only. Start blank is unchanged.
- Set coaching preferences opens the profile once. That click is remembered, including after a reload, even if the profile is still the starter text or blank. The same click inside demo stays in the demo and is not saved.

Parser check: the mobility trailing-character step was measured in Node on this machine. Ordinary text, 32,000 dashes, 32,000 colons, mixed dash/colon/space, and 32,000 spaces each finished in under 10 ms. The old multi-second case was not reproduced, so the parser was not rewritten. A regression test still requires a 32,000-dash mobility line to finish in under one second.

Checks on this source are recorded in V101-QC.md. These checks do not certify a physical iPhone.
