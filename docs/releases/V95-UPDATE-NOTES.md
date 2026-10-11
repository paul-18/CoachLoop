# Coach Loop v95 — Setup + Goal Targets (hybrid build)

Baseline: v94 at `e31143fc064793f3b3f7cc479337e85768cdcd85`.

This update replaces the first-use questionnaire with a fast setup flow and
replaces the three vague example goals with ten concrete, trackable targets.
It is a hybrid: Grok's complete setup/templates foundation, upgraded with a
structured goal model so editing a goal's wording can never break its progress
tracking.

## What changed

- **Quick setup replaces the old first-use questionnaire** on Today. Three
  screens, taps only, skippable, ~30 seconds. It does not type a profile for
  you.
  - Screen 1: What are you training? Strength / Running / Both / Just logging.
  - Screen 2: Pick a target. Ten concrete presets, shown for your focus.
    Drafts until you continue; existing goals are kept.
  - Screen 3: Start from a template — Push, Pull, Legs, Full-body starter,
    5K prep. One tap opens the existing import preview; nothing is saved
    until you confirm.
- **Ten goal presets, five measurement kinds** (all local, from logged data):
  - Strength (e1RM progress): Bench 225, Squat 315, Deadlift 405, Press 135.
  - Bodyweight (best-set reps): 10 strict pull-ups, 50 push-ups unbroken.
  - Run: Finish a 5K, 5K under 30:00.
  - Consistency: Train 3×/week for 8 weeks, Log 50 workouts.
- **Structured tracking.** Picking a preset creates a goal target with
  explicit fields (exercise, weight, reps, …). Progress binds to the fields,
  not the text — renaming a goal never breaks its bar.
- **Retroactive completion.** If your log already contains the target, it
  completes the moment you add it ("Achieved" with the date).
- **PR celebration at log time.** Logging a set that sets a new estimated
  record toasts it; if it reaches a tracked target, the toast names it.
- **One thing today** on the Today tab: the first unachieved target with its
  current standing. Deterministic, no AI.
- **Settings → Training goals**: a "Concrete targets" picker (drafts show
  live progress from your current log) plus your tracked targets with
  progress bars and removal. Free-text goals are unchanged.
- **Coach tab** lists tracked targets with progress under your priorities.

## Technical notes

- New `goalTargets[]` on the training state. Optional field — pre-existing
  stored states load untouched, no migration, no IndexedDB or backup-format
  change. Validated through the existing zod state boundary
  (`goalTargetSchema` in `training-validation.ts`); a regression test proves
  targets survive save/load instead of being silently stripped.
- No accounts, no backend, no AI keys, no push. All progress is estimated
  from eligible logged sets — an estimate, not a promise you can lift it.
- `setupComplete` is an optional settings flag so the setup does not return.
