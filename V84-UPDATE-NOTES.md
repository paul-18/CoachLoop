# Coach Loop v84

## Changes
- Eight dark-mode accents: Lime, Peach, Sky Blue, Soft Violet, Gym Red, Teal, Amber and Rose. Gym Red is a GoodLife-inspired red adjusted for readability, not an exact official brand colour. Existing theme IDs remain valid.
- Backup validation accepts the same theme choices shown in Settings. New themes persist across reloads and v84 backup restores.
- Selected exercise chips wrap within the trend controls and shorten long names with an ellipsis. The colour dot and remove icon remain visible. Full names are retained in titles and accessibility labels.
- The trend history action reads “View exercise history” rather than repeating a long exercise name. History dialog titles and session names wrap inside their available width.
- Selected point names also truncate without shortening the saved exercise name.
- README updated for eight themes and compact trend labels. The previous cleanup stays in place.

## Checks
Typecheck, lint, 114 tests, build and PWA checks pass. Checks include all eight themes through strict backup loading, preset/button-text contrast, repeated offline navigation and a long exercise label opening its full history. The build retains the existing non-blocking large-chunk warning.

## iPhone checks
1. After the new publishing run succeeds, finish and save any workout. Settings → Check updates → Restart to update. Confirm v84 in Settings.
2. Select each new accent under Appearance & quick log. Check readability on Today, Progress, workout controls and Settings. Close/reopen and confirm the choice stays saved.
3. Select an exercise with a very long name in Progress. Its selected chip should fit inside the card with an ellipsis, and its remove icon should remain visible. Add up to three exercises, then remove one.
4. Tap View exercise history: the dialog should show the full name without horizontal overflow. A long unbroken word must wrap too.
5. Check portrait, landscape and the smallest screen/large text setting you use. Actual iPhone rendering remains a device check.
6. If testing backups, use a synthetic log: export with a new theme and restore in v84. Older app versions cannot understand newly added theme IDs, so update before restoring these backups.
