# v87 — First-use guidance and goal ideas

Built against published v86, commit 664080cb6bd6b5eace61c9ea72f59d28586802a2.
All GitHub source files matched the local baseline before editing.

- Explains profile → ranked goals → external AI brief → FITLOG import → actual results → Finish workout.
- Adds import action, optional no-AI logging path, installation and private backup guidance.
- Shows whether profile and goals have been added. Keeps the guide available, collapsed, in Settings after the first workout.
- Offers consistency, strength and cardio goal drafts in Settings. Opens the existing editor; Cancel saves nothing, Save appends. No default goals, profile or fake workouts are inserted.
- Suppresses overdue bodyweight reminders until a previous measurement exists.
- Retains collapsible priorities on Coach and existing navigation/safe-area behavior.
- Adds an explicitly synthetic 1,000-workout / 12,000-set generator for QC. Its JSON output is not shipped as app data.

126 tests, TypeScript, ESLint, production build and PWA checks pass.
Existing main JS bundle warning remains: about 983 KB minified / 313 KB gzip.
This is not a bundle-size optimization or broad main-shell refactor.
Workout transition rules were extracted in v85; other shell orchestration remains.

Live v86 stress test: synthetic 9.27 MB JSON restored into an empty cloud-browser
log, all five tabs worked, oldest session searched/expanded, Progress rendered,
Coach showed both goals, and 1,000 sessions remained after reload. Captured console
warnings/errors: none. Live backup download capture timed out; its contents were
not verified. Generator serialization/parsing verified all 1,000 workouts and
12,000 sets locally (about 1.2 seconds combined on this machine).

Live tests cover desktop Chrome and strength history with four recurring exercises,
not Safari/iPhone, mixed sport histories or long-name stress. New v87 onboarding
was verified through React DOM tests, not the currently published v86 site.
See V87-QC.md for remaining device checks.
