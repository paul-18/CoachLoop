# v92 — FITLOG output and Coach brief check-in

Built against GitHub commit 7e9c37be17ac22af8fd7864b0e12dd8ed7540bc8 (v91); all 206 source files matched before editing.

- New-chat, continuing-chat and Copy format instructions share mandatory fenced text code-block rules: real newlines, one command per line, preserved blank columns and full corrected blocks. Numeric-only reps and per-side NOTES rules already existed and remain in both prompts.
- Joined structured commands now produce a specific newline/Copy-button error. The importer does not guess or rewrite a flattened workout. FITLOG stays version 1; saved workouts are never reparsed.
- Visible Anything to emphasize? textarea adds per-brief context, without changing the saved athlete profile. The note resets on the next dialog opening; copy it before closing. Existing optional request details remain available.
- Clear today’s fields empties energy, sleep, soreness, restrictions, upcoming PT, time, equipment, request and emphasis. It also clears the remembered same-day check-in through normal local saving. It preserves chat mode/history selection, last-sent timestamp, goals, profile, settings and training records. Wait for Saved before closing the app.
- Brief copy and helper text refer to your preferred AI rather than requiring ChatGPT.

No storage schema, dependency, theme, safe-area, tab, timer or service-worker changes. Prompt rules improve compliance but cannot guarantee a third-party AI follows them. Previously pasted briefs in existing chats do not update automatically: copy the new brief or format once after installing v92.

Release checks include TypeScript, lint, all tests, production build and generated PWA behavior. New tests cover fenced imports, flattened/partially joined commands, unilateral reps, both prompt modes, preview/copy, persistent clearing and retained profile/goals. Physical iPhone clipboard/keyboard behavior still needs the short V92-QC checklist.
