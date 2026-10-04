# Coach Loop v79 for GitHub Pages

Based on GitHub commit `97a10f4c26660854f4674ba36cce4ad2e6be06b0`, Coach Loop Sites v79 (`c798b2e407aaf832acf25666f55d0af69eb770e4`), and Rally's latest saved version, v8 (`341ff434ebe35126aeb774db0f6c9769821c7dc0`). The comparison covered the earlier Sites changes as well as v79 itself.

## Included

- Retained first-use guidance, example import, the waiting editor handoff, and the visible ranked goals on Coach.
- FITLOG version 1 instructions improved for strength, continuous cardio, intervals, repeated efforts, and mobility. Imports give contextual line errors and warnings; warnings must be acknowledged. Explicit load meanings, original block order, and import-size/load validation are preserved. Unsupported format versions fail clearly.
- Rep-range prescriptions require an actual rep count before completing a set. Existing saved history remains independent of later FITLOG instructions.
- Workout date dialog; corrected activity effort completion summaries, exports, totals, date validation, set matching across units, and strength comparisons.
- Larger Save/Cancel editors for profile and goals, accommodating the mobile visual viewport. Goal cards wrap fully. Ranked goals stay in the GitHub Coach layout.
- Backup-request timestamp now updates, recovery copies have readable labels, invalid state updates are rejected, pre-migration recovery copies are retained, and local saves flush when hidden and retry after a foreground return. Recovery download is available if the local log cannot open.
- Deferred loading of secondary tabs with recovery boundaries; Settings section links wait for the view to mount. First service-worker installation waits for activation. The rest timer refreshes on a return to the foreground.
- Male/female strength-coverage diagram choice. Female silhouette, head, neck, and hair use Rally v8's corrected geometry with Coach Loop colors and interactive regions. The setting changes the illustration only.
- Water polo is a supported routine activity in quick logging, FITLOG, the editor, exports, history, and progress totals. It records completed time and notes separately from swimming and circuits; no strength coverage or swimming distance is invented.
- Quick-log choices are limited to Run, Swim, Bike, Ruck, Circuit, Soccer, Grappling, Yoga, and Water polo. Choose, hide, and reorder them in Settings. Hiding shortcuts leaves stored sessions intact. Preferences round-trip through backup/restore; older backups receive defaults.
- Working ESLint configuration and automatic type/lint/test/PWA checks in the publishing workflow.

## Checks completed

- Clean frozen installation using pnpm 11.25.0 and Node 24.19.0: passed, including approved dependency builds.
- TypeScript: passed.
- ESLint: passed with no errors or warnings.
- 83 automated tests: passed, none skipped. Coverage includes historical evidence and restore safety, CSV formula protection, malformed imports, editor handoff, unit conversion, local saving failures, initial offline activation, water-polo totals, selected shortcut order, and diagram-region parity.
- Production Vite/PWA build: passed. The initial JavaScript bundle is approximately 618 kB (184 kB gzipped), versus 827 kB (256 kB gzipped) before this update. The added female diagram increases the deferred Progress bundle.
- Executed the generated service worker in an isolated cache harness: all 13 assets resolve beneath `/CoachLoop/`, offline navigation and split-tab assets are available, obsolete app caches are removed while unrelated caches are preserved, and manifest scope/start/icons resolve correctly.
- Rendered and inspected the female coverage SVG. This is a diagram inspection, not live browser or iPhone UI testing.

## Limits and publication

GitHub Pages remains local-only. Sites' D1 server, authentication, and live cloud-sync coordination are not included. Shared merge/validation helpers remain for compatible restores. No personal athlete profile or private training records are added.

These checks cannot guarantee that every browser interaction is bug-free. Physical iPhone keyboard, Add to Home Screen, offline switching, and update behavior still need testing after publication. The remaining large-chunk build warning is a performance advisory, not a build failure.

Nothing has been published by this package. Follow `UPDATE-INSTRUCTIONS.txt`; uploading the ZIP alone does not apply its source changes.
