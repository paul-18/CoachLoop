# Coach Loop v95

Baseline: v94 at `e31143fc064793f3b3f7cc479337e85768cdcd85`. No backup-format or IndexedDB change. Stored distances, times and actual results are unchanged.

- History, coach text, review and CSV print measured totals without long decimal tails such as `0.30000000000000004`.
- A mobility intervals line made of a huge run of spaces no longer freezes the tab. Normal mobility lines parse the same way.
- If the editor lock stops, the screen says so and offers Try again. It does not call that an unsupported browser, and it does not open a second writer. Returning to the app tries once. A missing Web Locks browser still cannot edit two copies.
- Readable secondary captions on Today, History and Coach use higher-contrast text. Mid-workout controls that were under 44px, including Last N, Collapse, header icons and the set check, are at least 44px.
- A new log opens with a short Today card instead of a five-step list on every tab. The steps, install note and backup note stay under How this works. The card still disappears after the first completed workout. Streak and HYROX stay hidden until the log has a workout.
- Load a safe example lists a bodyweight squat and an easy walk, then opens that list for review. It is not saved until you start or save it. The old 175 lb bench example is no longer loaded by that button.
- History delete says workout. Settings storage status uses plain language. The status can still change when the phone answers.
- Closing Change workout date returns focus to the Workout options button. The menu item that opened it is already gone, so focus no longer drops on the page.
- The desktop sidebar tab list is no longer forced to 36px tall, so Today does not overlap the subtitle. The shared tab component and the phone nav are unchanged.

Checks on this source: 179 tests, TypeScript, lint, production build and PWA checks passed. PWA release `df2e67ce26675c76a6b7`. Node 22.23.3 / pnpm 11.25.0. These checks do not certify the installed iPhone.
