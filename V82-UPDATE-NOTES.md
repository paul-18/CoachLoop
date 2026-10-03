# Coach Loop v82 — revised

Update overlay for the supplied v81 edition. Existing local data, goals, restores, theme identifiers and shortcut preferences remain compatible.

- Revised package: fixed workout save-failure warning now uses the shared top inset plus landscape side insets; its Retry save action is preserved. No additional fixed top-2 app banners were found.
- Portrait installed PWA uses a shared safe-top variable. Reported iOS safe insets are respected; installed portrait sessions reserve at least 56 px when the launch-time inset is zero/smaller. Browser tabs and landscape keep reported insets without that minimum. Standalone detection includes Safari's navigator.standalone fallback.
- Normal pages, workout/Hyrox headers, desktop/mobile toast offsets and dialog safe bounds use the same top inset. Workout header height and rest-timer/content offsets agree. Dialogs scroll within the safe viewport; landscape header/content sides respect safe left/right insets. A non-interactive top backing strip in installed mode keeps scrolled content from painting through the status area.
- Update-check feedback is rendered inline in Settings, as well as making other notifications safe-area aware. It says a check was requested rather than claiming no update before a worker finishes installing. Controlled activation/save/other-window safeguards remain unchanged.
- Female hair fill AND stroke are neutral dark grey, along with the existing neutral face/neck. No peach/brown hair colour remains.
- Coverage uses five distinct neutral shades: none, under 4, 4 to under 7, 7 to under 10 and 10+ effective sets, from dark grey to near-white. Matching swatches, explanatory ranges and numeric totals avoid depending on hue alone. All themes share this scale. Coverage measures completed working-set credit, not perceived effort/intensity; selection outlines may use the app accent.
- Coach priorities use an accessible native disclosure, initially collapsed. Expand to read all ranked goals and edit them. The full goal text and AI brief content remain intact.
- Appearance names are Lime, Peach, Sky Blue and Soft Violet; saved identifiers are unchanged.

Verification: 113 automated tests pass, including real DOM goals expand/collapse, actual notification desktop/mobile safe-offset props, repeated navigation/shortcut order, long goal text and distinct coverage levels. TypeScript, lint, production build and offline/subpath/update-worker checks pass. Manifest/lockfile/dependencies are unchanged from the verified v81 clean frozen install. No personal backup or credential is included. Large-bundle warning remains non-blocking (~311 KB gzip).

Physical iPhone Dynamic Island rendering is not verified by the DOM tests. The portrait fallback intentionally adds conservative clearance on installed phones without a notch too. Test startup, bounce scroll, notifications, all dialogs, workout/rest header and rotation on the actual installed app. Do not clear website data to update. See V82-IPHONE-QC.md.
