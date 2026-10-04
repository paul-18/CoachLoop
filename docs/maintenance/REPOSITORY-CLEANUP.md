# Repository cleanup for Coach Loop v83

Historical record only. The one-shot cleanup script was retired in v91 after its work was complete. Do not run the old deletion procedure on current releases; use the current root upload instructions.

Reviewed GitHub main at `142bb94ca7e5a6ae92c24e8156b7cd2e95f9bde3`.

This housekeeping package updates the README and removes 64 unused source files. It preserves the installed app's v83 release name. Removing template sources changes the generated CSS and build identifier, so installed apps should apply the new build through Settings after publishing.

## Why these files can be removed

The entry point, app imports, re-exports, test imports, dynamic imports and test-harness source paths were traced. These files are not reachable from the app, tests or build configuration. Many UI templates only import other unused templates. The remaining app-level files are redundant wrappers, an unused effort picker and removed sync-queue/payload stubs.

The cleanup script limits deletion to this reviewed list. It checks each tracked file's content hash and stops before deleting anything if a file differs. No force flag or broad directory deletion is used. Its default mode only previews; `--apply` stages exact removals with `git rm`. The script never commits or pushes.

## Kept intentionally

- All active app components, tests, workflow, dependencies and lockfile.
- IndexedDB, restore/merge, migration and conflict compatibility helpers: cloud-related names do not make these disposable. They protect existing backups.
- Manifest, icons, PWA generation/check scripts and project configuration.
- Vendor CSS and its licence. Public source still has no chosen project licence; this cleanup does not choose one for the owner.
- Historical release notes and iPhone QC guides: useful records of what changed and what to test.
- Re-export files still imported by regression tests.

## Validation

After these removals: typecheck, lint, all 113 tests, production build and PWA checks pass. The README FITLOG example parses without warnings. Cleanup preview, refusal of modified files, exact deletion and repeat execution were checked in a temporary Git fixture.

Generated CSS fell from approximately 243KB to 137KB (gzip 39KB to 25KB). JavaScript size is effectively unchanged. Actual iPhone appearance still requires a brief device check.

## Exact deletion list

- `app/effort-picker.tsx`
- `app/exercise-substitution.tsx`
- `app/field-conflicts.ts`
- `app/hyrox-ui.tsx`
- `app/muscle-mapping-settings.tsx`
- `app/persistence/sync-payload.ts`
- `app/persistence/sync-queue.ts`
- `app/sync-queue.ts`
- `app/training-migrations.ts`
- `app/training-review.tsx`
- `app/training-storage.ts`
- `app/training-validation.ts`
- `app/use-local-editor-lease.ts`
- `app/views/effort-picker.tsx`
- `components/ui/accordion.tsx`
- `components/ui/alert.tsx`
- `components/ui/aspect-ratio.tsx`
- `components/ui/attachment.tsx`
- `components/ui/avatar.tsx`
- `components/ui/breadcrumb.tsx`
- `components/ui/bubble.tsx`
- `components/ui/button-group.tsx`
- `components/ui/calendar.tsx`
- `components/ui/carousel.tsx`
- `components/ui/chart.tsx`
- `components/ui/collapsible.tsx`
- `components/ui/combobox.tsx`
- `components/ui/command.tsx`
- `components/ui/context-menu.tsx`
- `components/ui/direction.tsx`
- `components/ui/drawer.tsx`
- `components/ui/empty.tsx`
- `components/ui/field.tsx`
- `components/ui/form.tsx`
- `components/ui/hover-card.tsx`
- `components/ui/input-group.tsx`
- `components/ui/input-otp.tsx`
- `components/ui/item.tsx`
- `components/ui/kbd.tsx`
- `components/ui/label.tsx`
- `components/ui/marker.tsx`
- `components/ui/menubar.tsx`
- `components/ui/message-scroller.tsx`
- `components/ui/message.tsx`
- `components/ui/navigation-menu.tsx`
- `components/ui/pagination.tsx`
- `components/ui/popover.tsx`
- `components/ui/progress.tsx`
- `components/ui/radio-group.tsx`
- `components/ui/resizable.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/select.tsx`
- `components/ui/separator.tsx`
- `components/ui/sheet.tsx`
- `components/ui/sidebar.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/slider.tsx`
- `components/ui/spinner.tsx`
- `components/ui/switch.tsx`
- `components/ui/table.tsx`
- `components/ui/toggle-group.tsx`
- `components/ui/toggle.tsx`
- `components/ui/tooltip.tsx`
- `hooks/use-mobile.ts`
