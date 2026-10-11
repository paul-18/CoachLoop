# Coach Loop v100

Baseline: v99 on main. No backup-format or IndexedDB version change. There is no demo mode in this app, so none was added.

- The welcome screen says the log stays on the phone, and that a plan comes back from an AI chat as FITLOG. Start with an example is the main button. Start blank stays secondary. Restore backup opens Backup & export.
- Start with an example names the plan Starter session and marks it as the starter. It is planned, not completed. The two goals stay visible on Today until a workout is finished, and Edit opens Training goals.
- Remove starter deletes only that untouched plan. Original starter goals and the original coach profile are cleared only if they were not edited. Any other workout stays. It does not erase the device.
- Coach explains a brief, FITLOG, and RPE, and shows a short valid FITLOG example. PT is defined where upcoming events are edited.
- Typed weight, reps, and minutes look solid. Planned numbers stay as the lighter placeholder.
- History and Progress no longer say to start on Today once a plan exists.
- After the first workout that has a completed set or activity, Today says: Saved on this phone. Next: back up once from Settings, or ask your AI for a plan. Got it hides it for good. A skip, or a finish with nothing completed, does not show it.

Checks on this source: 193 tests, TypeScript, lint, production build and PWA checks passed. PWA release `085398c8be9ede76b9a6`. Node 22.23.3 / pnpm 11.25.0. These checks do not certify the installed iPhone.
