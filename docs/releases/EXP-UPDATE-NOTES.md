# Coach Loop — experimental branch build (feature-testing)

Experimental only: AI coach chat (bring-your-own-key) + manual calorie tracking + the v95 rest-timer notifications, on top of v94. Nothing here is on `main`; the live site is unaffected.

## AI coach chat — your key, your choice, no backend

- New **Settings → AI** section: provider preset dropdown (OpenRouter, OpenAI, Google Gemini, Groq, or a custom OpenAI-compatible endpoint), API key field (password, show/hide), model field, and a **Test connection** button that sends a tiny "reply ok" ping. **Clear key** removes it from the device.
- The key is stored **only on this device** (in the app's local settings). It is **never included in JSON backup exports** — restoring a backup on another device will not carry your key along. Nothing about the AI feature phones home to anyone except the provider you choose, when you press Send.
- New **Ask AI** chat in the **Coach** tab, above the existing brief/copy sections. Before the first send it shows a one-line summary of the training context that will be included (coaching profile, goals, recent sessions, strength records — built by the same brief builder as "Build coach brief", so it matches what you'd paste manually today).
- With no key set, the chat area shows guidance instead of a dead input: where to get a free key (OpenRouter free models, Google AI Studio, Groq free tier). The app behaves exactly as before — the existing **copy-prompt flow is unchanged**: "Build coach brief", quick-copy, and FITLOG copy all work with no key.
- Honest mapping of failures: rejected key (401/403), rate limits (429), network errors, and malformed responses each get a plain-language message. No streaming in this experiment.
- Privacy note: when you chat, the training context shown is sent to your chosen provider. That's your key and your call; the app shows what's included before you send.

## Calorie tracking — manual logging

- New **Nutrition** section on the **Today** tab (after Quick log): daily target vs consumed vs remaining, protein total, meal list with per-meal delete, and an add-meal form (name + kcal + optional protein).
- Daily calorie target lives in **Settings → Workout defaults** ("Daily calorie target (kcal)"). The target is snapshotted onto a day when its first meal is logged, so changing the setting later doesn't rewrite history.
- Validation: names trimmed, empty names rejected, kcal must be 0–20,000, protein optional ≥ 0. No sample meals, no fake data — empty days simply show "No meals logged today."
- Meal logs are ordinary training data: they ride along in JSON backups and restore-merge like everything else.

## Also in this build

- The **v95 rest-timer notifications** (opt-in Settings → Notifications; silent "Rest over" alert when a rest timer ends while the app isn't frontmost; tap focuses the app). See `docs/releases/V95-UPDATE-NOTES.md`.

## Trying it

1. Open the beta link after it redeploys from `feature-testing`.
2. **AI**: Settings → AI → pick OpenRouter → "Get a free key" link → paste key → Test connection → Coach tab → Ask AI.
3. **Calories**: Today tab → Nutrition → add a meal; set your target in Settings → Workout defaults.
4. **Notifications**: Settings → Notifications → Enable (iOS: install via Add to Home Screen first).

## iOS notes

- AI chat works anywhere the app runs (it's just HTTPS fetch).
- Rest notifications need the installed Home Screen PWA (iOS 16.4+) and are best-effort when the app is fully backgrounded.
- A persistent "live workout card" on the lock screen is **not possible** for PWAs on iOS (no sticky web notifications) — deliberately out of scope.

## Deferred

Meal photo estimation, program auto-generation, food-database search (Open Food Facts), lock-screen persistent workout notification, streaming chat responses.
