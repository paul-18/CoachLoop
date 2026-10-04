# v90 — measured performance, backup verification and accessibility

Apply over v89 at `c60470cea3d871a6bf8f2835bafe68d5dc769534`. The main shell remains split.

## Changes

- **Settings → Verify saved backup:** select the JSON actually saved in Files; inspect compatibility, session/set/activity counts, dates, goals, profile presence and measurements. It never restores, updates a backup timestamp or writes your log. Corrupt, incompatible and oversized files receive readable errors. Closing during a read discards late results. “Readable, compatible” does not prove latest-export matching or correctness of every training value.
- **Routine validation:** changed workouts receive full schema/integrity checks. Unchanged workouts are reused only after admission by the validator and deep freezing. Other sections and cross-workout IDs, tombstones and active references are checked every edit. An internal save path accepts only admitted immutable states, avoiding a second full parse and pre-queue clone. IndexedDB still copies the whole state at write. Loads, backups, restores and final confirmations retain full validation. No blur-only logging or database migration.
- **History:** 50 sessions per page; search and filters still cover all history. Page/expanded session are remembered, and daily-summary links reach the correct page. Export is computed only with its dialog open, across the selected full-history range. Pagination does not exclude older records from export.
- **Accessibility:** set weight/reps/options/completion/note controls identify exercise and set, plus weight units/mode where relevant. Evidence errors are associated with inputs and announced politely. Completion exposes pressed state. Set menus regain normal focus return; closing a set-note dialog returns to that set's options.
- Reproducible synthetic benchmark scripts use Node, jsdom and fake IndexedDB; no personal log or installed app is touched.

## Measurements

Same-run Node medians: five routine runs, three final-confirmation runs. Exploratory server timings, not iPhone performance promises:

| Sessions / sets | Previous full validation + save path | v90 routine validation | v90 edit + committed save | v90 full final confirmation + save |
| --- | ---: | ---: | ---: | ---: |
| 100 / 1,200 | 36.72 ms | 0.32 ms | 4.43 ms | 35.19 ms |
| 1,000 / 12,000 | 362.75 ms | 0.58 ms | 39.80 ms | 218.99 ms |
| 5,000 / 60,000 | 1,832.19 ms | 2.55 ms | 225.60 ms | 1,234.58 ms |

The benchmark compares the original general save path and new internal path in one run. It does not measure input-to-paint. A prior run gave 413 ms at 1,000 and 1,910 ms at 5,000: timings vary.

Whole React journeys still cost more than isolated validation/storage. At 5,000 sessions, one exploratory v90 DOM run took about 2.6 seconds for cold opening and 2.1 seconds for Progress. Before/after History pagination, opening improved from about 1.74 seconds to 0.31 seconds and search from 216 ms to 33 ms, with 50 rather than 5,000 cards rendered. These one-run figures include development rendering and polling. jsdom has no real layout or paint; these are not acceptance thresholds.

Whole-state IndexedDB copies, full validation on load/confirmation, Progress calculations and snapshot payload reads remain. At 5,000 sessions, snapshot listing took roughly one second in fake IndexedDB. Per-workout storage and snapshot-metadata migration need separate atomic migration/rollback design and device measurements.

From the repository root, synthetic memory/database only:

```sh
node --import tsx scripts/benchmark-history.ts /tmp/coach-loop-history-benchmark.json
node --import tsx scripts/benchmark-ui.cjs /tmp/coach-loop-dom-benchmark.json
```

## Read-only Git-history check

Fetched advertised branches/tags on 2026-10-04; only `main` was advertised, at the baseline above. Scanned 33 reachable commits / 633 Git objects, including 14 historical ZIPs / 476 members. Checked 929 text payloads; four binary image payloads were not inspected for embedded private information. Credential-pattern, authenticated-URL, email and serialized-training-backup heuristics found no matches. Historical backup/export/recovery-named paths were source files. Earlier defaults were checked and contain no prepopulated personal log.

This does **not** certify absence of secrets or personal information. Unreachable objects, unadvertised/PR refs, issues, Actions logs/artifacts and embedded image metadata were excluded. No credential was identified; no rotation or history rewriting was performed.

## Follow-up and boundaries

- Real iPhone/Safari QC and original tab-freeze cause remain unproven. Do not infer a routing or waiting-worker cause.
- Explicit failed-attempt outcomes, open-existing duplicate-import navigation, incremental storage/snapshot metadata, further editor splitting, complete accessibility/contrast audit and dependency/CSP evaluation remain separate.
- No accounts/cloud, AI API, wrapper, persistent backup nags, top update banner, automatic chunk-error reload or data reset.
- v89 final-save, restore-preview and controlled-update protections remain. Updates stay Settings-only. Timestamp rest timer, themes, coverage, collapsed Coach goals and safe-area CSS are unchanged.
