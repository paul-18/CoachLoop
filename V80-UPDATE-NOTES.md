# Coach Loop v80 — GitHub update

This cumulative source update includes the previous v79 work and adds:

- Selectable Last 7 days cards: keep one, two, or more supported activities. These selections are independent of Today quick-log buttons.
- Four accent presets: Coach Loop lime, Rally peach, sky blue, and soft violet. The background stays dark.
- Modify Progress at the bottom of Progress to hide/show sections, including Lift balance. The button remains available even when all sections are hidden.
- The same controls in Settings → Appearance & quick log, with reset options.
- Display preferences saved locally and included in JSON backups. Older backups use the existing layout and lime accent.
- The app release label is v80. Ranked goals remain visible in Coach.

The ZIP replaces files in the existing repository; it contains no extra app folder. It targets paul-18/CoachLoop's onboarding commit 97a10f4c26660854f4674ba36cce4ad2e6be06b0, and can also be applied after the supplied v79 update. If you have made other source edits since then, review the changes before overwriting those files.

## Original customization verification

Superseded for the reliability update by V80-RELIABILITY-NOTES.md and IPHONE-QC.md.

- TypeScript check passed.
- ESLint passed with zero warnings and errors.
- All 89 automated tests passed, including selective card rendering, hidden sections, backup compatibility, completed activity evidence, and accent contrast.
- Production build passed. The generated service worker passed the offline/subpath check for 14 assets under /CoachLoop/.
- Archive integrity, overlay contents, and common credential-pattern checks passed.

The production build's large-chunk warning is non-blocking. Physical iPhone testing and publishing remain outstanding. This update keeps the GitHub app local-only; it does not add a Sites database, API credentials, or cross-device synchronization. The source/ZIP checks are not an audit of all historical GitHub commits or repository settings.

See UPDATE-INSTRUCTIONS.txt for the upload and verification commands. The v79 notes describe the earlier cumulative changes.
