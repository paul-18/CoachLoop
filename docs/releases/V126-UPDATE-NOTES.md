# Coach Loop v126 Update Notes

## Summary

Release **v126** fixes the headline defects from the v125 review: the date picker dismissing dialogs, segmented-run totals disagreeing across views, a FITLOG MODE line rejecting a whole import, the editor back button label, empty workouts saving, toasts covering the Undo-import bar, large backups freezing the page, the missing manual rep cap, and the coach brief mixing dates.

## Changes

- Date-picker day taps no longer dismiss the Log bodyweight, Change workout date, or Export dialogs. The shared dialog primitive suppresses outside-click and Escape dismissal while a date or time input inside the dialog is focused.
- The reported modal traps (HYROX × close, coach-brief × close, HYROX Open session leaving the setup modal, FITLOG Save for later leaving the import modal) were reproduced in WebKit and do not occur: all four flows close correctly, so no code changed there.
- Segmented-run totals now use one shared summary-wins aggregation across History, the Progress Runs card, Monthly review, and the coach brief. A run's summary stands over its segment breakdown, and walk intervals in a run count toward the run.
- A FITLOG MODE line with extra values (for example `MODE|summary|20 min|3 km`) no longer rejects the whole block: the mode is kept, the extra values are ignored with a warning, and the valid parts import. Import errors now carry a one-line fix for the common AI mistakes.
- The editor back button reads "Back to History" when the workout came from History, and "Back to today" otherwise.
- A workout with nothing marked complete cannot be finished, in the editor or from a History edit. Duplicate exercise names warn when typed and are noted in the finish dialog.
- Top toasts sit below the demo bar and the Undo-import bar instead of covering them.
- Backups over 10 MB parse in a Web Worker so the page stays responsive; the 50 MB limit and all validation are unchanged. Settings now shows how many completed sessions have passed since the last backup.
- Manual actual reps are capped at 5,000, matching the FITLOG cap.
- The coach brief is built as of its `today` date throughout: completed sessions, bodyweight, schedule, and strength records no longer leak in from after that date.

See the [v126 changelog entry](../../CHANGELOG.md#v126--release) for the release summary.
