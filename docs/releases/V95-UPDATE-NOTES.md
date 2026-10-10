# Coach Loop v95

Local (on-device) rest-timer notifications — no server, no account, no push backend.

- New opt-in Settings → Notifications panel. The permission request runs from the Enable button's tap, which is the user gesture iOS requires. Honest status text covers unsupported (not installed / older iOS), denied, off, and on.
- When a rest timer finishes while the app isn't in front of you, a silent notification appears ("Rest over — Next: …"). Silent by design: no sound or vibration, keeping the app's quiet-controls preference. While the app is visible, the on-screen timer already says it, so no notification fires.
- Tapping the notification focuses the open app (or opens it) via a new `notificationclick` handler in the generated service worker.
- Works where the Notifications API exists: installed Home Screen PWA on iOS 16.4+, Android/Chrome, desktop. iOS suspends background tabs, so the alert is best-effort if the app was fully backgrounded — the timer itself still resynchronizes on return.

No backup-format or IndexedDB change. The `notificationsEnabled` setting is optional and defaults off; older logs are unaffected.

Tests: 10 new cases in tests/v95-notifications.test.ts covering permission states, the visible-app suppression, the tagged silent payload, service-worker preference for taps, failure paths, and the worker template's tap handler.
