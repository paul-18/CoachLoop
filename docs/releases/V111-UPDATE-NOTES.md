# Coach Loop v111 — update notes (published)

Status: published from `main` at `601b795`; GitHub Pages workflow run #67 passed and deployed (`sw.js` digest `bc33a93b6f8aa66128ee`). Verified on Paul's iPhone 17 on 2026-11-01.

This release fixes exactly the eight things Paul raised in his v109
phone-test review on 2026-11-01, in his words, and nothing else.

## What changes

### 1. Plain words — "parts" is gone from the UI

Paul: "Idk what parts mean.."

Every user-visible string that said "part" or "parts" now says
something plain:

- Generic stepper (run/walk/bike/row/hike/ruck/other): "Interval" —
  "Interval N of M", "Add interval", "Show all · N intervals",
  "All N intervals resolved", "Interval N removed".
- Circuit keeps "Round", swim keeps "Set" — the two stay distinct.
  (Paul called a circuit round a "set" in passing; Round-for-circuit
  / Set-for-swim was kept deliberately so the two never collide.)
- Ungrouped circuit units show their station plan text ("Push-ups
  x15") instead of "Part N of M".
- "Complete unknown parts" becomes "Done: rest of these rounds" /
  "Done: rest of these sets" / "Done: rest of these intervals". The
  plural is deliberate: the footer button completes the whole group,
  not one round/set/interval.
- An unlabeled segment of kind "other" reads "Interval" instead of
  "Part".
- Toasts, aria labels, buttons, group footers, and Show-all are all
  covered, and a test fails if any stepper string literal still
  contains "part" (plus a journey that scans rendered stepper text,
  aria labels, and titles).
- The sweep also covers coach export, History, and progress summaries:
  history badges read "N of M intervals done", group labels read
  "Repeat group · N of M rounds/sets/repeats done · N of M intervals
  done" (the group word follows the activity type — the old label
  hardcoded "rounds" even for swim groups), and progress counts read
  "Name N/M intervals".

### 2. Quick-add for manual logging

Paul: "it should be easy to just add the log yourself too.. like if
u did 5 min run and 5 min walk and 4 min run and so on… like I
should be able to quickly input that. Currently feels like a lot of
clicks…" and "the run walk is nice if provided by fitlog, if im
trying to input it or change it… it seems really hard…"

The generic stepper now has an inline quick-add row, always visible:
kind chips (Run / Walk / Rest / Other), one minutes field, one Add
button. Tapping Add appends the interval and leaves the row ready —
minutes cleared, kind kept — so "5 min run, 5 min walk, 4 min run" is
three quick taps plus typing, with no form navigation and no
per-interval save round-trip. The row also accepts Enter to add.

Two supporting changes:

- "Add intervals" (the entry button on a segment-free run/walk/etc.)
  now opens the stepper on an empty list instead of inserting a blank
  interval, so quick-add chaining starts clean instead of leaving a
  stray blank interval to delete.
- Tapping an existing interval still expands it for inline
  duration/distance editing: one tap + type + done, no extra screen.
  That flow is covered by a journey.

The grouped stepper (circuit/swim) does not get a quick-add row: its
ungrouped section is small and the set/round cards would have to bend
around it. Generic stepper only, as the brief allowed.

### 3. Circuit redesign — stations always visible, Done round, unlimited rounds

Paul: "each circuit should just have a done 1 set and have exercise
just showing constantly.. and be able to do as many sets as you
want.. like but displayed in a better way.."

- The station list is always visible for circuits. There is no
  Show-all hiding for stations anymore, and stations stay expandable
  for duration/distance actuals exactly as before.
- One "Done round" action completes the current round's unknown
  stations only; skips are never auto-completed.
- A rounds-done counter ("N rounds done") is always visible.
- Reaching the prescribed round count completes the activity. The
  toast Undo reopens it and restores the round, so this is recoverable.
- "Add another round" stays available — including after the activity
  completed — and appends a cloned round from the pattern (round 1's
  stations, fresh ids, all unconfirmed). "Done round" can then
  complete it. Rounds are unlimited, as asked.
- "Done: all rounds" + Undo toast kept.

Swim keeps its set-card flow: current card + dots + Done + Show all.
Only the spacing fix below touches swim.

### 4. Swim spacing fix

Paul: "In swim under parts everything is so close.. like text. This
Set 1 of 40 of 1 parts doneDone: Set 1 / Set 2 of 40 of 1 parts
doneDone: Set 2 …" — that "of 40" was "Set 1 of 4" glued to "0 of 1
parts done", a spacing bug plus a confusing micro-counter, not a
count of 40.

- Each set row is its own padded block (grid, 8px gap, 10px padding),
  with the title, the status word, and the Done button as distinct
  elements 12px apart. They can never glue into one string again.
- The per-unit "N of M parts done" micro-counter is gone entirely.
  Done state is already visible via the button and the dots, and for
  multi-segment sets the group footer carries progress: "Repeat group
  · X of Y sets done · A of B segments done".
- Verified structurally at phone width (390px): title, status, and
  action asserted as three distinct nodes, plus the CSS gap/padding
  rules pinned by test. jsdom cannot measure layout, so the structural
  + CSS pin is the verification, same as the v108 UI-fix tests.

### 5. Routine (segment-free) circuits get a rounds counter

Paul, on the Garage circuit: "should show what I need to do.. and i
be able to say I did this many rounds.. as the other…"

The routine view already showed "What I did / rounds" — that stays
prominent — and now adds a rounds-done counter: a "Done round"
button, an "N rounds done" display, a minus control to remove one,
and an Undo toast on Done round.

Storage: a new OPTIONAL `roundsDone` number on the activity. It was
chosen to need no migration and no evidenceVersion bump:

- Old-shape activities without the field load fine.
- New-shape activities round-trip through the loader (the activity
  schema passes unknown fields through, and the loader spreads whole
  activities, so older builds ignore the field cleanly).
- Completing the activity keeps the rounds count.
- Covered by a unit test (old shape, new shape, completion) and a
  journey (increment, decrement, fresh-app reload, completion).

### 6. Mobility density

Paul: "Mobility is fine, takes a lot of space tho"

Same content, less space: move rows go from 10px/12px padding to
6px/10px with tighter gaps and slightly smaller type, and moves no
longer stack to two lines on phones — the narrow-screen rule that
forced a single column (doubling every move's height) is gone, so
each move stays one row: name + prescription. No pose cards and no
per-move status were added — that decision is still open with Paul
and explicitly out of scope.

### 7. Effort completed state — the check never glues onto the plan

Paul, on sled push and pull: "The check from clicking done in sled
push and pull looks odd, is that really the best way to put it?"

Each effort row is now three separate things: a leading slot (the
effort number, or a check mark when done) + the plan as its own
element + an action slot that reads plain "Done" in both states. The
Done button is the same node before and after completion, so nothing
shifts; tapping Done on a completed effort undoes it. 44px targets
kept.

The grouped current card was checked too, as asked: its plan text and
Done action were already separate elements (the card shows the
current, never a completed, unit), so it needed no change. The actual
gluing sites were the effort rows and the swim set rows, and both are
fixed.

### 8. Simpler stepper chrome

Paul: "Repeat selected pattern and all seems complex for a simple
user.. it should be simple to use…"

- The default view shows only: current card + dots + Done + Show
  all (plus quick-add on the generic stepper, and the rounds counter
  / Done-all / station list on circuits, which their own items
  require).
- Repeat is a per-group one-tap button — "Repeat this round" /
  "Repeat this set" / "Repeat this interval" — acting on its own
  group directly. It appends exactly one iteration cloned from the
  group's first iteration, with fresh ids and no actuals, so there is
  nothing to guard and nothing to lose.
- The selection step is gone entirely: no checkboxes, no "Repeat
  selected pattern xN", no "Repeat count (2–50)" input, no "Select
  one or more … as the pattern" helper text. Ungrouped intervals have
  no repeat button anymore; quick-add is the simple path for adding
  another one by hand.
- Complete-all for generic/swim now lives behind Show all (it is an
  advanced action, not default chrome). Circuit "Done: all rounds"
  stays visible, as the circuit item requires.
- Advanced actions that remain are plain single-tap buttons with
  plain words.

### Small semantics unification (needed by the counter)

A round/set now counts as done when nothing in it is unknown and at
least one station was done. A round with a skipped rest is a finished
round; an all-skipped round is skipped, not done. This keeps the
circuit rounds counter, the progress dots, and the group footers in
agreement (before, a finished round with a skipped rest counted in
none of them consistently). An all-skipped iteration still counts as
skipped everywhere, as the existing v2 test requires.

## Deliberate non-changes

- No FITLOG v3 parser or prompt changes (v110 untouched).
- No strength-logging changes, no totals/labels arithmetic changes.
- No Done-semantics changes beyond the circuit prescribed-count
  completion above (generic/swim activity completion stays
  independent of interval completion, as in v108/v109).
- No segments-exist rule change, no post-session card changes, no
  yoga rejection change.
- No mobility pose cards or per-move status (decision still open).
- No evidenceVersion bump, no new stored field beyond the optional
  `roundsDone`, no new infrastructure, accounts, cloud sync, AI keys,
  or paid APIs.
- Synthetic fixtures and disposable data only — no real backup or
  training data was imported, copied, or tested against.

## Deviations from the brief (small, with reasons)

- Group-footer done-rest buttons read "Done: rest of these
  rounds/sets/intervals" (plural) instead of the brief's singular
  "Done: rest of this round/set/interval", because the footer button
  completes the whole group, not one round/set/interval. The singular
  would misdescribe the action.
- Quick-add is generic-stepper only. The brief allowed this if the
  grouped ungrouped section did not fit without complicating it; the
  set/round cards would have had to bend around a kind-chip row, so
  it was left out and is stated here, not silently dropped.
- Circuit "Done: all rounds" stays in the default view even though
  the simplicity item lists default chrome as current + dots + Done
  + Show all, because the circuit item explicitly says to keep it.
- The grouped current card keeps its labeled Done ("Done: Set N" for
  swim; "Done round" for circuits) rather than gaining a leading
  check, because the current card never shows a completed unit — the
  leading-check pattern applies to completed states, which live on
  the effort rows (fixed) and the swim set rows (spacing-fixed).

## Tests

New: `tests/v111-simple-logging.test.ts` (plain-words labels, stepper
literal guard, one-tap repeat, `roundsDone` compatibility) and
`tests/v111-journeys.test.cjs` (quick-add chaining + inline editing,
rendered plain-words scan across all three steppers, circuit
redesign incl. beyond-prescription rounds, Done-all Undo, routine
rounds incl. reload persistence, swim spacing + micro-counter gone +
one-tap repeat, mobility density, effort leading check).

Updated for intentional behavior changes: v108/v109 journeys and the
v108 UI-fix tests (Interval/Round/Set wording, Show-all counts,
complete-all behind Show all, circuit stations always visible,
circuit Done-all completing the activity, effort leading-check
layout), plus the release stamp tests (v111 current, v112 future,
dotted v111.2).

## Gate

- TypeScript: pass. Lint: pass.
- Tests: 365/366. The single failure is the known v103 trailing
  timing test (`trailing_separator_strip_grows_linearly`: a 32KB dash
  tail took 180.7 ms vs 20.2 ms for 16KB under full-suite load). It
  passes in isolation, it is unrelated to v111 (FITLOG parser timing,
  untouched by this release), and it is the only failure — CI judges.
  The full suite passed 366/366 on the earlier run before the lint
  fix; the gate re-run differed only by this flake.
- Production build: pass. PWA generation: pass (release hash
  `ad552312f2510511eb44`, the expected live digest). PWA behavior:
  pass (7 cached files, offline cache repair, mixed-release
  rejection, release retention, subpath and deliberate update
  safety).
- WebKit smoke: cannot launch on this VM — `browserType.launch:
  Host system is missing dependencies` (libgtk-4, libgstreamer, and
  friends). Environmental, not a test failure; CI judges.
