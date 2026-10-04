# v90 iPhone QC

Save a private JSON backup in Files first. Use a disposable browser/profile for synthetic data and destructive/failure tests. Never replace your personal log with synthetic data.

Record **v90 + build ID** from Settings, iOS version, Home Screen vs Safari, orientation, preceding taps and results. Node/DOM checks do not establish real-device behavior.

## Installed-app checks

1. **Finish/reopen:** log an actual set; watch Saving → Saved. Finish; check History date/actuals; close/reopen and check again. Test tabs after Finish, note dialogs, profile/goals editing and cancelled backup dialogs. Regressions here take priority.
2. **Saved-file verification:** Settings → Share backup / Save to Files; finish saving. Verify saved backup → choose that actual file. Expect compatible, sensible counts/dates, profile/goals presence. Closing verification must not change your log or last-backup-request timestamp. File-picker cancellation does nothing.
3. **Restore round-trip:** in a disposable profile/device, restore that file and compare sessions, profile, goals and measurements. Structural verification alone is not this round-trip. Keep your original private file.
4. **Bad files:** in a disposable profile select truncated JSON, a newer-version file, and unrelated JSON. Expect readable errors, no changes, working tabs after Done. Close during a slow read; a late result must not reopen it.
5. **VoiceOver:** open a two-exercise workout with repeated sets. Inputs/options/completion should announce exercise, set and weight units. Invalid reps in a disposable workout should have an associated explanation; correct and complete. Open a set note then Done; focus should return to that set's options. Finish/review/navigate. Check the real announcements and keyboard navigation; automated checks only inspect DOM relationships.
6. **Enlarged text / keyboard:** inspect workout, verification, Settings and History paging in portrait/landscape with larger text. Title/buttons must clear the Dynamic Island and keyboard. Check top safe areas and fixed bottom navigation from the Home Screen icon; their CSS is unchanged.
7. **Update after backgrounding:** idle, Saved, editors closed → Settings → Check updates → Restart when available. Close another app window if asked. No reload during editing. Never clear storage/uninstall to force an ordinary update.

## Larger-history checks — disposable profile only

- Benchmark scripts use isolated Node memory/fake IndexedDB; they do not populate your phone. The existing generator can create a 1,000-session test JSON: `node --import tsx scripts/generate-qc-history.ts /tmp/coach-loop-synthetic.json`. Never commit it or restore it into your personal log.
- History: 50 cards per page, Next/Previous, oldest-session search, clear search, completed/skipped filters, expanded-session memory after another tab. Daily summary → View session must reach the correct page. Text export should include all pages in the chosen range.
- Measure cold open, multi-digit weight/reps entry, Finish, History search, Progress and recovery copies. Repeat three times on the same device online/offline. Note visible stalls, duration and save status. Finish first-time offline preparation before testing offline.
- Phone-only checks: actual Files/share completion, process kill/reopen and background suspension. Interrupted-save/quota tests use a disposable log. Only committed Saved data is expected to survive; do not deliberately kill a personal edit.

## Stop and report if

Saved data disappears/changes, verification writes the log, a failed Finish dismisses the editor without explanation, tabs stick, or updates reload during editing. Record build/device and exact taps, keep your backup, and do not clear storage or attach private JSON to a public issue.

Cold-load/Progress costs remain follow-up work. This is not exhaustive accessibility certification, eviction testing or proof of the original navigation cause.
