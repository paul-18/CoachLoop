# Coach Loop v98

Baseline: v97 on main. No backup-format or IndexedDB version change.

- A new log asks one question: Try the starter plan, or Start blank. Today no longer lists the goals, the profile, and the how-to at once.
- Try the starter plan saves two goals, Bench press 225 lb and Run a 5k under 30 minutes, the starter coach profile, and the existing example workout as an editable plan. Start blank saves nothing else.
- The 5k goal is only that sentence. It does not tell you to change the time.
- The starter coach profile tells the AI to program one session at a time from completed work, and to return one FITLOG block. It does not mention the settings screen.
- The desktop sidebar tab list is no longer forced to 36px, so the tabs no longer overlap the subtitle. The phone tab bar is unchanged.
- Finish workout, opened from Workout options, returns focus to that button when it closes.
- The installed-app manifest has a stable id, and the icons are listed separately as any and maskable.
- Progress says "No completed sets in this range" instead of "No unambiguous entries."

Not in this update: iOS splash screens, a Vite or dependency bump, and the larger code-structure cleanup. Those do not change a saved workout.

Checks on this source: 188 tests, TypeScript, lint, production build and PWA checks passed. PWA release `3604c0b56777b9f9e834`. Node 22.23.3 / pnpm 11.25.0. These checks do not certify the installed iPhone.
