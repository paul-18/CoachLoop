<div align="center">

# 🔁 Coach Loop

**A local-first training log with a copy-and-paste bridge to the AI coach of your choice.**

Plan it. Log it. Review it. Hand it to your AI. Bring the next workout back.

[![Open the app](https://img.shields.io/badge/Open-Coach%20Loop-brightgreen?style=for-the-badge)](https://paul-18.github.io/CoachLoop/)

![PWA](https://img.shields.io/badge/PWA-installable-blue)
![Offline](https://img.shields.io/badge/works-offline-success)
![Local-first](https://img.shields.io/badge/data-stays%20on%20your%20device-informational)
![No account](https://img.shields.io/badge/accounts-none-lightgrey)
![No built-in AI](https://img.shields.io/badge/AI-bring%20your%20own-orange)

</div>


---

## Table of contents

- [What is Coach Loop?](#what-is-coach-loop)
- [Quick start](#quick-start)
- [Install on iPhone](#install-on-iphone)
- [First-time setup](#first-time-setup)
- [The coaching loop](#the-coaching-loop)
- [Features](#features)
- [App sections](#app-sections)
- [Your data, privacy and backups](#your-data-privacy-and-backups)
- [FAQ and troubleshooting](#faq-and-troubleshooting)
- [Updates](#updates)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [Credits](#credits)

---

## What is Coach Loop?

Coach Loop is a training log for people who lift, run, ruck, and do everything in between. It keeps your goals and history in one place, turns them into a **coach brief** you paste into an AI chat, and lets you import the workout the AI writes back.

It covers strength workouts, cardio, sports, conditioning, and mobility.

### Bring your own AI

- Chat with your AI **outside** Coach Loop, in its own app or website.
- Some buttons mention ChatGPT, but the workflow is plain copied text. Any assistant that can follow the **FITLOG** format should work.
- Coach Loop has **no built-in AI chat, no API connection, and no account**. Any subscription belongs to the AI service you choose.

### At a glance

| | |
| --- | --- |
| 📱 **Platform** | Web app / installable PWA (no App Store) |
| 💾 **Storage** | On your device (no automatic sync) |
| 🔌 **Offline** | Yes, once offline files are ready |
| 🤖 **AI** | Your choice, via copy and paste |
| 💸 **Cost** | Free (your AI service may charge) |

---

## Quick start

1. **Open** the app: **[paul-18.github.io/CoachLoop](https://paul-18.github.io/CoachLoop/)**
2. **Set up** your coach profile and ranked goals ([details](#first-time-setup)).
3. Go to **Coach → Build coach brief → Start a new chat → Copy full context**.
4. **Paste** the brief into your AI and ask for your next workout as a single `[FITLOG:1] ... [/FITLOG]` block.
5. **Import** the block in **Today → Import workout**, review the preview, and train.

You can start with an empty log. Tell the AI what you know about your training and let history build over time.

---

## Install on iPhone

Installing as a Home Screen app gives you an icon, full-screen use, and offline support.

1. Open the [live app](https://paul-18.github.io/CoachLoop/) in **Safari** (not the GitHub repository page).
2. Tap **Share**. Depending on your layout, it may be inside the page menu.
3. Choose **Add to Home Screen**. If it is missing, look under **Edit Actions** in the Share menu.
4. Leave **Open as Web App** enabled if shown, then tap **Add**.
5. Launch Coach Loop from the new icon **while online**.
6. Check **Settings → On this device → Offline files** for **Ready for offline use** before relying on it without a connection.

> [!NOTE]
> Offline covers logging. Your AI conversation still needs whatever connection your AI service requires.

[Apple's Home Screen guide](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios)


---

## First-time setup

### 1. Write your coach profile

**Settings → Coach profile.** Tap **Insert starter guidance** for a template, then edit it. Good things to include:

- Training background and activities you enjoy
- Long-term goals (stronger, bigger, faster, more endurance)
- Usual schedule, equipment, and time limits
- Limitations and lasting preferences (short warm-ups, preferred session length)
- How you want to be coached: explanations, progression style, workout format

> [!TIP]
> Keep **lasting** context here. Put **today's** sleep, soreness, energy, and schedule in the coach brief instead.

> [!WARNING]
> Only include details you're comfortable sending to your chosen AI.

### 2. Rank your goals

**Settings → Training goals.** Add specific goals, delete ones that don't apply, and use the arrows to order them. **Your most important goal goes first.**

Example order: strength → muscle growth → running endurance. Tell your AI to respect the ranking when goals compete for time or recovery.

Need ideas? Expand **Example goals** to try a consistency, strength, or cardio draft. Edit it for your own baseline and schedule, then tap **Save**. Cancel adds nothing; examples never replace your existing goals.

The first-use guide walks through profile → ranked goals → AI brief → FITLOG import → logged results and Finish workout. It disappears from all screens, including Settings, after your first completed workout. You can also use Blank workout or Quick log without an AI.

On **Coach**, tap **Your priorities** to expand your full ranked goals. Keep it collapsed when you want a simpler screen. Profile and goal editors support multiline text with Save and Cancel.

### 3. Set workout defaults

**Settings → Workout defaults:** pounds or kilograms, usual rest time, bar weight.

Already have a backup? Restore it with **Settings → Restore JSON backup**.

### 4. Start your first AI chat

1. **Coach → Build coach brief**
2. Choose **Start a new chat** (includes your full profile and goals).
3. Add today's energy, sleep, soreness, restrictions, and upcoming activity. Use **Optional request details** for available time, equipment, and what you want planned.
4. Tap **Copy full context**.
5. Paste it into a new conversation in your AI of choice.
6. Discuss your goals, then ask for your next workout as **one** `[FITLOG:1] ... [/FITLOG]` block, following the instructions in the brief.

---

## The coaching loop

Ask your AI → import the plan → log what you actually do → review → send your next brief.

| Step | What you do |
| --- | --- |
| **1.&nbsp;Ask** | Send your coach brief to the AI and discuss the next session. |
| **2.&nbsp;Import** | Copy the AI's **complete** FITLOG block. In **Coach → Paste or save workout** or **Today → Import workout**, paste it and check the preview before starting or saving. |
| **3.&nbsp;Train** | Log actual reps, loads, effort, and activity results. Mark work complete as you go. If you change the plan, log what you really did. |
| **4.&nbsp;Review** | Check **History** and **Progress**. Download a backup regularly. |
| **5.&nbsp;Continue** | In **Coach → Build coach brief**, choose **Continue existing chat**, copy the recent update, and paste it into the *same* conversation. Choose **Start a new chat** whenever the AI needs the full background again. |

### Brief shortcuts

- **Mark sent** records that you shared a brief (it doesn't send anything). Choose the “since last brief” option to include newer sessions and later corrections.
- For a shorter update, copy your **last workout**, **today's training**, or the **last two days**.
- **Copy format** shares only the FITLOG instructions.
- **Anything to emphasize?** adds a note to this brief only, for any AI you choose. It is not remembered after closing or added to your profile. **Clear today’s fields** clears readiness, PT, restrictions and optional request details, including the remembered same-day check-in; your profile, goals and history stay intact.

### FITLOG at a glance

FITLOG is the plain-text format the AI uses to hand you a workout. It's wrapped in one block:

```text
[FITLOG:1]
WORKOUT|Example strength and easy run|2026-10-03
EXERCISE|Bench press
SET|6-8|40 kg total|RIR 2
REST|120
CARDIO|Easy run
TYPE|run
DURATION|15
INTENSITY|easy
[/FITLOG]
```


This is a format example, not a personalized prescription. Change its date, load and activities before using it. The in-app **Copy format** button provides the current full instructions.

The SET reps column accepts only numbers or ranges, such as `10` or `8-10`. For unilateral work, use `SET|10|10 lb total|RPE 7` and put “Perform 10 reps per side” in the exercise NOTES. Do not write `10 each side` or `10/side` in the reps column. Log reps per side consistently; the app does not automatically double them when calculating volume.

If an import fails, see [troubleshooting](#faq-and-troubleshooting).

---

## Features

### Training

- **Strength logging**: sets, reps, loads, RPE/RIR, warm-ups, notes, and rest timing. Planned work stays separate from completed results.
- **Activities and mobility**: running, rucking, swimming, cycling, rowing, walking, hiking, circuits, FORCE, soccer, grappling, yoga, water polo, and more. Mobility plans can go movement by movement.
- **Readable intervals**: semicolon-separated run instructions display as stages.
- **HYROX simulation** *(optional)*: run-and-station timer with division selection.

### Insight

- **Lift balance**: compares recent completed bench, squat, deadlift, and overhead press results, with pull-ups shown separately. These are loose training guides, and the underlying sets and dates stay visible. Missing data does not mean a weakness.
- **Strength coverage**: shows completed lifting work over the last seven days using a charcoal-to-gold scale. Darker means less coverage; brighter gold means more. Tap a muscle for its effective sets and contributing exercises; selecting it adds an outline without changing its coverage colour. Primary muscles receive 1 credit per working set and secondary muscles 0.5. Warm-ups and cardio are excluded. This is volume coverage, not strength, recovery or effort intensity.
- **Benchmarks**: pin repeatable tests, record dated attempts and protocols, and set optional re-test intervals (**Settings → Pinned benchmarks**).
- **Choose your display**: select one of eight accents: Lime, Peach, Sky Blue, Soft Violet, Gym Red, Teal, Amber or Rose in **Settings → Appearance & quick log**. Pick which **Last 7 days** cards you want to see; these choices are separate from quick-log activities. At the bottom of **Progress**, tap **Modify Progress** to hide or show sections such as Lift balance. Hiding a section keeps its saved data.
- **Personalize Today**: choose and reorder quick-log activities in Settings → Appearance & quick log. Select the male or corrected female strength-coverage diagram there; the choice changes the illustration only.
- **Weekly streak**: five distinct completed training days in a Monday–Sunday week qualify. Tap the streak to open the training calendar.

### Data

- **JSON backup**: full, restorable copy of your data.
- **CSV export**: for spreadsheets and analysis, including warm-up labels and actual activity results (view only, not restorable).
- **Import safeguards**: FITLOG preview, readable validation errors and duplicate warnings. **Undo import** is available for the most recent saved import while it remains unstarted.

---

## App sections

| Section | Use it to |
| --- | --- |
| **Today** | Start or resume a workout, preview saved plans, import a session, quick-log an activity, see upcoming events and your weekly streak. |
| **History** | Review past sessions and results. Edit a workout, including its date. |
| **Progress** | Explore exercise trends, records, bodyweight, recent activity, the training calendar, strength coverage, and Lift balance. |
| **Coach** | Expand your ranked goals, build context for an external AI chat, copy recent training or FITLOG instructions, and bring a workout plan back in. |
| **Settings** | Edit profile, ranked goals, units, and defaults. Manage benchmarks, muscle mappings, backups, exports, and offline status. |


---

## Your data, privacy and backups

> [!IMPORTANT]
> This GitHub Pages edition stores data **locally on your device**. It does **not** sync between phones, computers, or browsers. Another device means a separate log.

**Privacy**

- Your training is never sent to an AI automatically. You decide what to copy and share.
- The website is public, but every visitor gets their own local log.
- Other projects on the same `paul-18.github.io` hostname share a browser origin. Keep their scripts trusted; a different repository path is not storage security isolation. See [hosting and storage boundaries](docs/maintenance/HOSTING-AND-STORAGE.md).

**Backups**

- Use **Settings → Download full backup** regularly and store the JSON somewhere safe (Files, iCloud Drive).
- Choose **Verify saved backup** to inspect the JSON saved in Files without restoring or changing your log. It reports compatibility, counts and dates; it does not confirm latest-export matching.
- To move to another device, open Coach Loop there and choose **Restore JSON backup**, then review the preview.
- **Merge** combines records and keeps newer revisions. An older backup may therefore leave newer local goals, profile or measurements unchanged.
- **Complete restore** makes workouts, goals, coach profile, measurements and settings match the backup. Current-only records are removed, so download a current backup first. A local recovery copy is also saved before the restore.
- Full JSON backup export and restore use the same **50 MB** limit. Larger-than-10-MB backups are supported, but allow extra time on a phone. If your log exceeds 50 MB, the app refuses to create a file labelled a restorable full backup; keep the log and request a split-backup solution rather than clearing storage.
- If the saved log cannot open, the error screen offers **individual recovery checkpoint JSON files**, plus a diagnostic bundle containing the saved raw data and all readable checkpoints. Restore an individual checkpoint on a working installation; the diagnostic bundle is not a normal backup. Keep both kinds of file private.
- Neither restore option creates ongoing sync between devices.
- Expand **Review exact changes** before restoring to inspect changed results, notes and other sections. Distinct workout IDs are preserved even if they share an old import origin. Contradictory live/deleted records are rejected; keep the original file for recovery. A failed merge preview leaves Cancel and Complete restore available. The app saves the exact reviewed candidate and requires a new review if your log changes meanwhile.
- Local recovery copies live on the same device, so they don't replace an external backup.
- Clearing browser site data or losing your device can erase locally stored training.
- Keep private backups **out of this public repository**.

---

## FAQ and troubleshooting

<details>
<summary><b>Do I need ChatGPT?</b></summary>

No. Any AI assistant that can follow the FITLOG format should work. Some buttons mention ChatGPT because that's what the workflow was first built around.
</details>

<details>
<summary><b>Does my data sync between my phone and laptop?</b></summary>

Not automatically. Download a JSON backup on one device and restore it on the other.
</details>

<details>
<summary><b>My workout import failed or the preview looks wrong.</b></summary>

- Make sure you copied the **whole** block, from `[FITLOG:1]` to `[/FITLOG]`.
- Ask for a fenced, copyable **text code block** with one command per actual line; use the code block’s Copy button. Visual word wrapping is not a newline. Keep SET reps numeric (`10` or `8-10`); put “per side” in NOTES.
- Ask the AI for **one** FITLOG block, with nothing inside it other than the format.
- Use **Copy format** and paste it into your chat to remind the AI of the rules.
- Review the preview before saving. Nothing is imported until you confirm.
</details>

<details>
<summary><b>It won't work offline.</b></summary>

Open the installed app while online, then check **Settings → On this device → Offline files** for **Ready for offline use**.
</details>

<details>
<summary><b>I lost my data.</b></summary>

If you have a JSON backup, use **Settings → Restore JSON backup**. Choose **Merge** to combine records and keep newer changes, or **Complete restore** to replace workouts, goals, profile, measurements and settings with the backup. Complete restore removes current records absent from that backup; a recovery copy is saved first. If a workout was accidentally deleted, use **Merge** with **Recover deleted records with new IDs** in the restore preview. Ordinary restore preserves deletion protection. Without an external backup, data cleared from browser storage cannot be recovered, so back up regularly.
</details>

<details>
<summary><b>A restore did not bring back my old goals or profile.</b></summary>

Merge keeps newer local revisions, including your profile and goals. If you want the entire saved state from a backup, download your current log first, then choose **Complete restore** and review what will be replaced.
</details>

<details>
<summary><b>Coach Loop says it is already open elsewhere.</b></summary>

Finish saving and close the other Coach Loop window. Only one window can edit the local log at a time; the waiting window opens automatically when the editor is released.
</details>

<details>
<summary><b>The AI forgot my background.</b></summary>

Start a new chat with **Start a new chat → Copy full context**.
</details>

---

## Updates

v92 strengthens FITLOG instructions in both brief modes and Copy format, with copyable code-block/newline rules and clearer errors for joined commands. It adds a per-brief emphasis note and Clear today’s fields, while retaining the v91 reliability fixes. See [v92 notes](docs/releases/V92-UPDATE-NOTES.md), [iPhone QC](docs/releases/V92-QC.md) and [v92 upload steps](docs/releases/V92-UPLOAD.txt).

For future ZIP updates, upload the ZIP directly into Codespace beside package.json, rather than committing it through GitHub. Follow [the reusable upload procedure](UPDATE-INSTRUCTIONS.txt) and the package's exact baseline, file list and deletions. Existing historical ZIPs are not removed from Git history by deleting today's file.

v90 adds **Settings → Verify saved backup**, clearer exercise/set/unit labels, and faster routine edits by validating changed workouts while retaining integrity checks. History shows 50 sessions per page; search and exports still cover the whole log. See [v90 notes](docs/releases/V90-UPDATE-NOTES.md) and [device QC steps](docs/releases/V90-QC.md). v89's durable final saves, restore review, completed-evidence protection and controlled updates remain. v88's app-shell split remains too.

After saving a JSON file in Files, use **Verify saved backup** to inspect compatibility, counts and dates without restoring it. A readable, compatible file is not proof it matches your latest export or every recorded value is correct. Keep it privately and test restoration on a disposable profile for a full recovery check.

The workout header shows Saving, Saved or Not saved. Finish, history-edit confirmation, saved/imported plans and new-workout opening wait for the local transaction before reporting success. If a final save fails, the editable workout or import preview is retained. Routine input edits still save automatically. A saved transaction protects against ordinary write failure; it cannot prevent browser-storage eviction, so external backups remain important.

Changing a completed set to invalid actual reps or effort makes it an incomplete draft. Correct it and mark it complete again. Actual reps require a positive whole count; actual RPE is 1–10 and RIR is 0–10, using one effort scale at a time. Existing ambiguous legacy results are preserved and flagged for review. Empty sessions and warm-up-only lifting do not count as training days; completed child efforts still count when their parent activity is unfinished. Empty saved sessions remain in History and backups.

To check a release locally, run `pnpm release:check`. This runs typecheck, lint, tests, build and PWA checks, then writes a report under `.release-checks/`. GitHub Actions uses the same checks and retains its QC report for 14 days. Passing automated checks should be followed by the device QC above.

Open the app online periodically. Updates are checked on return to the foreground, or open **Settings → On this device → Check updates**.

When **Restart to update** appears, finish any active workout, close the editor and wait for **Saved on this device**. Tap it for one intentional restart. Another open Coach Loop window must be closed first. The app does not automatically restart during a workout.

If a requested activation takes longer than the waiting screen allows, the request remains pending. On return, the app checks for that exact worker and saves again before restarting. An active workout, open editor, focused input or failed save defers it. **Restart to update** remains available in Settings for retry. There is no automatic update restart without an earlier deliberate request.

The first upgrade from an older edition can still require closing all Safari and Home Screen windows, then reopening online, because that old edition lacks this button. Closing all windows remains a fallback if activation fails. Never clear website data to update: that deletes the local log.

Keep a current backup before moving to a different app address. The app release is shown in Settings. v86 clarifies numeric-only FITLOG reps and per-side instructions in both new-chat briefs and continuing-chat reminders. It does not change the parser, stored workouts or volume calculations. v85 improves unfinished-workout recovery, checkpoint downloads, release-verified offline cache repair and header sizing on rotation. Coverage totals and explanations use the same aliases and refresh with the local day. v84 added eight accent themes and compact exercise trend labels; v83 introduced the gold coverage scale and extra portrait workout-header clearance. Long chart labels are shortened visually, while the exercise history dialog preserves their full names.

For a release, check both a fresh install and an update from the previous version, with synthetic data first. Pull requests now run non-deploying checks; publishing from main still runs typecheck, lint, tests, build and PWA checks. See [v85 release notes](docs/releases/V85-UPDATE-NOTES.md) and [iPhone QC](docs/releases/V85-IPHONE-QC.md). Do not use your live log for destructive failure testing.

### Developer setup

Use Node 24 and the pinned pnpm version from `package.json`. From the repository root, run `npx --yes pnpm@11.25.0 install --frozen-lockfile`, then `npx --yes pnpm@11.25.0 run dev` for local development or `npx --yes pnpm@11.25.0 run release:check` before publishing. Local backups contain private data; keep them out of commits. The current upload procedure is [UPDATE-INSTRUCTIONS.txt](UPDATE-INSTRUCTIONS.txt); older release notes are historical.

For repository owners, see [upload and cleanup instructions](UPDATE-INSTRUCTIONS.txt).

---

## Contributing

Bug reports and ideas are welcome. Please [open an issue](../../issues) and include your device, browser or OS version, and steps to reproduce. Do **not** attach personal backups or training data.


---

## Disclaimer

Coach Loop is a logging tool and a way to move text between you and an AI. It is not medical advice, a physical therapist, or a replacement for a qualified coach. AI-generated workouts can be wrong, so use your judgment, scale to how you feel, and talk to a professional about injuries or health concerns.

---

## Credits


*Created using AI.*


[Documentation archive](docs/README.md): release notes, version-specific QC checklists, general iPhone testing and maintenance records.
