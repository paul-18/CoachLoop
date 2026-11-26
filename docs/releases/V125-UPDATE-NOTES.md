# Coach Loop v125 Update Notes

## Summary

Release **v125** focuses on durable planned-workout skipping, History edit navigation, wake-lock recovery on resume, improved PWA icons, and small interface polish.

## Changes

- Planned workout skipping now uses the durable `commitState` save path and only skips workouts whose status is `planned`; save failures are surfaced.
- Editing a workout from History and using the back arrow returns to History, keeps `?view=history` in sync, and restores the saved History scroll position.
- Wake-lock resume clears pending retry state and resets the bounded retry counter before reacquiring, allowing recovery after repeated failed requests or release events.
- Added an opaque 180×180 Apple touch icon and dedicated 192×192 and 512×512 maskable icons with artwork inset for adaptive masks.
- Alert-dialog overlays dim instantly and dialog content no longer fades in from transparency; close animations remain unchanged.
- Demo History now displays a visible read-only cue for disabled menu actions.
- Lift balance rows receive extra bottom padding when explanatory text wraps.

The optional Chromium `file_handlers` registration for `.json` and `.fitlog` was not included.

See the [v125 changelog entry](../../CHANGELOG.md#v125--release) for the release summary.
