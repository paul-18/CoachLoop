# Coach Loop v101

Baseline: v100 `3fa13a2e8f7769f8248aae0fba22b38f9efb86f1` on origin/main. No IndexedDB or backup-format change. Existing logs, goals, profiles, units and quick-log choices stay compatible. Demo mode is not in this release.

- The workout header and the finish dialog now use the same counts: sets, efforts and activities, with skipped work left out. History counts an exercise only when it has a completed set, and says “1 session” or “1 set” when there is one.
- Skipping an activity keeps it out of the rest timer’s Next line. Skip activity is in the activity menu.
- Ticking a set without typing still logs the suggested reps and load. The row and History say Suggested when that happened. The app does not store a separate “typed versus suggested” flag beyond the existing completed-as-planned mark.
- The one-time saved-on-this-phone note appears for a starter or a blank log after a real working set or a completed activity. A warm-up checkbox alone does not show it. Got it still hides it for good.
- Starter goals is the heading only while those exact starter goals are still there. Your own goals say Your goals. A kilogram log gets Bench press 100 kg and a practical kg sample (20, 60, 70, 75, 80, then 85 kg, and 4 kg dumbbells per hand). Pounds stay 225 lb and the existing pound loads.
- Remove starter asks first. It still deletes only the untouched Starter session, and clears starter goals or the starter profile only if they were not edited. A quick-log list you changed is kept. An untouched new log keeps the four starter buttons rather than switching on every activity.
- While the welcome screen is up, Import workout, Ask ChatGPT and Blank workout stay hidden. Restore backup stays a quiet link. The screen says the app has no AI of its own. There is no demo button.
- An empty lift list on Progress is one line. A number that is an estimated max says bodyweight-only sets are excluded.

Parser check: the mobility trailing-character step was measured in Node on this machine. Ordinary text, 32,000 dashes, 32,000 colons, mixed dash/colon/space, and 32,000 spaces each finished in under 10 ms. The old multi-second case was not reproduced, so the parser was not rewritten. A regression test still requires a 32,000-dash mobility line to finish in under one second.

Checks on this source are recorded in V101-QC.md. These checks do not certify a physical iPhone.
