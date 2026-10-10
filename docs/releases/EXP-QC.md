# Coach Loop — experimental branch QC (feature-testing)

Branch base: v94 (`e31143f`) + v95 notification tree + AI + nutrition. Full gate: `npx --yes pnpm@11.25.0 run release:check` — TypeScript, ESLint, tests, production build, PWA generation/behavior checks.

## Test counts

- Baseline (v94+v95): 183 tests, all passing.
- New: 40 tests — `tests/exp-ai-client.test.ts` (8), `tests/exp-ai-coach-context.test.ts` (5), `tests/exp-ai-settings.test.ts` (10), `tests/exp-nutrition.test.ts` (17).
- Total: **223/223 passing.**

## What the new tests cover

- **AI client**: request shaping (URL, model+messages passthrough, trailing-slash trim, `Authorization: Bearer`), error mapping (401/403 → bad key, 429 → rate-limited, network failure, malformed JSON), and that thrown error messages never contain the key.
- **Coach context**: the chat system prompt embeds the same training extract as the "Build coach brief" dialog's options (profile, goals, recent sessions, PRs); the one-liner summary reports real counts.
- **AI settings logic**: provider preset → base URL resolution, custom base URL, empty-model falls back to preset default, null config without a key, preset-switch model-fill rule; render smoke tests (guidance card, custom-URL field gating, context one-liner).
- **Nutrition**: day totals/remaining math, meal validation edges (trim, empty name, negative/NaN/huge/zero kcal, optional protein), migration defaults for missing logs, descriptive errors on invalid shapes, nutrition logs included in backups while the AI key is stripped, restore-merge unions meals by id.

## Manual checks still worth doing on a real iPhone (beta link)

- AI: paste a real key, Test connection, send a chat message; confirm the context one-liner matches your log; confirm Clear key removes it.
- Calories: log/delete meals, over-target display, target change doesn't rewrite past days.
- Notifications: real rest-timer expiry with the app backgrounded (installed PWA).
- Backup: export JSON, confirm no `aiApiKey` string in the file; restore on a second browser and confirm the key field stays empty there.

## Not tested here

- Real provider round-trips (need a live key + network; covered by Test connection in-app).
- Cross-browser PWA behavior beyond the automated PWA checks.
