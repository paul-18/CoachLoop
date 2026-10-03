# Coach Loop v83

- Strength coverage uses five distinct charcoal, bronze, amber and pale-gold levels. The effective-set thresholds and totals are unchanged.
- No muscle is selected initially. Tap the map or muscle totals to open its details. Selection and keyboard focus add an outline without brightening the data colour.
- Installed portrait workout and Hyrox headers have 8px additional clearance below the existing safe area. The workout header height, rest timer and content offsets grow together. Safari tabs and landscape retain their existing spacing.
- Settings displays v83; this is an update to the same local app and database.

## iPhone checks
1. Finish and save any workout, then use Settings → Check updates → Restart to update. Close another Coach Loop window if requested. Confirm v83 in Settings.
2. Open the installed app in portrait. Start a blank workout: check the title, back button and Done control clear the status area at rest and while scrolling. Test a long workout title and keyboard open.
3. Start a rest timer: its strip should sit below the header, with no hidden first exercise. Rotate to landscape and back. Check the Hyrox header too if used.
4. Open Progress: no muscle should be outlined initially. Tap Chest, then another muscle. Only the outline changes; fills continue to reflect their set totals.
5. Check male/female diagrams and all four themes. The five legend colours must remain distinguishable; head and hair remain neutral.

Automated validation does not verify real iPhone rendering; the small extra clearance needs device confirmation.

## Validation
Typecheck, lint, 113 tests, production build and PWA checks pass. The DOM regression checks no initial selection and unchanged muscle fill on selection. The build retains the existing non-blocking large-chunk warning.
