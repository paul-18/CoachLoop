# Coach Loop v81

Update package for the supplied v80 Reliability edition, in the same existing GitHub repository. No extra app folder. Keep a private JSON backup before applying.

- Normal app content is inset below the iPhone PWA safe area, including status/error/import notices. Removed the status/update strip from every page. Fixed workout/Hyrox headers keep their existing independent safe-area handling.
- Check updates, release/build identity, local-save status and Restart to update now live only in Settings → On this device. Active-workout, saved-state and other-window safeguards remain.
- Strength detail uses “excludes BW”. Weekly strength is volume (load × reps), now written explicitly as lb × reps or kg × reps. It cannot honestly be labeled as a single strength/max-weight value.
- Female head and neck use neutral dark fills matching the silhouette. Coverage uses a consistent blue brightness scale, legend and muscle-total swatches for every theme; selection outlines still use the chosen accent.
- Settings now renders selected quick-log activities in their actual chosen order, followed by unselected choices. Moving Water polo visibly changes its row and the Today order.
- JSON restore offers Merge (newer local values can win) and Complete restore (use the backup only). Complete restore restores backup goals, profile, measurements, preferences and workouts regardless of newer local timestamps; records absent from the backup are removed. Both modes checkpoint the current log and commit storage before changing the UI. Invalid files and failed writes retain the original saved state. Recovery copies remain on this device; complete restore is different from Erase.
- Preview includes record changes, goal/measurement counts and whether the resulting coach profile is empty. Restore method resets to Merge for each new file; deleted-record recovery is offered only for Merge.

Verification: 109 tests pass; TypeScript, lint, production build and service-worker offline/subpath/update checks pass. Dependency manifest and lockfile are unchanged from the verified v80 frozen install. The ZIP overlays the supplied v80 Reliability source exactly. No personal backup or credential is included. The larger eager bundle warning remains non-blocking (~311 KB gzip).

Physical iPhone PWA safe-area, theme rendering and Safari restore/share-sheet QC remain outstanding. This release preserves Coach goals and v80 personalization; it is not automatically published.
