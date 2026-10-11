# Coach Loop v97

Baseline: v96 on main. No backup-format or IndexedDB version change. Stored kilometres are not rewritten.

- Entering 1005 m shows 1005 in the editor and in History. The stored kilometres stay as they are.
- History → Export and a workout's Delete menu return focus to the button that opened them.
- Gym Red uses a lighter accent so small red text stays readable. Faint white text that was at 45% or below is now 56% or text-white/60. Placeholders are unchanged.
- A new log shows two goals, Bench press 225 lb and Run a 5k under 30 minutes, and a short coach profile. Use these goals and Use this profile save them. Ask your AI stays off until both are saved.
- See an example workout opens the list, not the raw FITLOG text. The bench is a light warm-up plus four heavier sets, then pull-ups, dips, lateral raises, and mobility.
- Quick log for a new log is only Run, Bike, Circuit, and Yoga. After the first completed workout, the full Settings list comes back.
- If the phone drops the screen-wake lock while a workout is open, the app asks for it again.
- A weight that is not a real number no longer counts as a positive load.
- A future settings field is kept when the log is read, instead of being stripped.

Left as they are: blank lines inside a FITLOG stay blank with no warning, and the skipped-set helpers still differ in code that today's log cannot reach.

Checks on this source: 188 tests, TypeScript, lint, production build and PWA checks passed. PWA release `c2a7832a18a0db048257`. Node 22.23.3 / pnpm 11.25.0. These checks do not certify the installed iPhone.
