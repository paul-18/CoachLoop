# Coach Loop v99

Baseline: v98 on main. No backup-format or IndexedDB version change.

- A new log keeps Run, Bike, Circuit, and Yoga on Today. Swim, ruck, and the others stay in Settings → Quick-log activities, and they stay there after the first workout unless you turn them on.
- Choosing the starter plan or a blank log saves that same short list.
- The example workout lists Easy bike as one closed row. Its minutes field stays closed until you tap Log.

Checks on this source: 189 tests, TypeScript, lint, production build and PWA checks passed. PWA release `26d969e27ad184bd67a2`. Node 22.23.3 / pnpm 11.25.0. These checks do not certify the installed iPhone.
