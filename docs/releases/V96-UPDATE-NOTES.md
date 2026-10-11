# Coach Loop v96

Baseline: v95 source, or v94 at `e31143fc064793f3b3f7cc479337e85768cdcd85` if v95 is not committed yet. No backup-format or IndexedDB version change. Stored metres, seconds and completed results are not rewritten.

- A bad mobility paste no longer freezes the tab. That fix is already in v95 and stays.
- Erase this device's data still clears the log and older recovery copies, and now keeps one copy of the log you just erased. Settings lists it as Before resetting data. If the erase fails, the log and the older copies stay.
- Repeat workout copies measured minutes and kilometres rounded to two decimals. A 61-second effort becomes a 1.02 min target, not `1.0166666666666666`. Completed results already in History are not changed. Plan previews and the minutes placeholder also print the rounded number.
- An exercise aliased to a known movement, such as bench → Barbell Bench Press, shows that muscle match in Settings. It is no longer listed as unmapped or not assigned. Coverage totals were already counting it.
- A new log starts with goals and a coach profile, not Paste a workout or Ask your AI. Ask your AI appears after both are saved. Example goals start at bench 225 lb and a 5k under 30 minutes. Coach profile opens on starter guidance and asks you to change it before saving.
- The example workout is a 5-minute bike, a weighted bench, bodyweight pull-ups and dips, light lateral raises, then mobility. It is still only a draft until you start or save it.

Left for a later pass: unknown settings fields, wake-lock re-acquire, NaN weight checks, and the smaller wording items. Nothing in those is failing on today's log.

Checks on this source: 184 tests, TypeScript, lint, production build and PWA checks passed. PWA release `e9b9e4269029f0a797c5`. Node 22.23.3 / pnpm 11.25.0. These checks do not certify the installed iPhone.
