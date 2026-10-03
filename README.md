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

<!-- TODO: add a hero screenshot or short GIF here, e.g.
<p align="center"><img src="docs/screenshots/today.png" width="280" alt="Today screen"></p>
-->

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

<!-- TODO: add Android / desktop install notes if you've tested them. -->

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

```text
   ┌──────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
   │   Ask    │ ──► │  Import  │ ──► │  Train  │ ──► │  Review  │
   └──────────┘     └──────────┘     └─────────┘     └────┬─────┘
        ▲                                                  │
        └────────────────── Continue ◄─────────────────────┘
```

| Step | What you do |
| --- | --- |
| **1. Ask** | Send your coach brief to the AI and discuss the next session. |
| **2. Import** | Copy the AI's **complete** FITLOG block. In **Coach → Paste or save workout** or **Today → Import workout**, paste it and check the preview before starting or saving. |
| **3. Train** | Log actual reps, loads, effort, and activity results. Mark work complete as you go. If you change the plan, log what you really did. |
| **4. Review** | Check **History** and **Progress**. Download a backup regularly. |
| **5. Continue** | In **Coach → Build coach brief**, choose **Continue existing chat**, copy the recent update, and paste it into the *same* conversation. Choose **Start a new chat** whenever the AI needs the full background again. |

### Brief shortcuts

- **Mark sent** records that you shared a brief (it doesn't send anything). Choose the “since last brief” option to include newer sessions and later corrections.
- For a shorter update, copy your **last workout**, **today's training**, or the **last two days**.
- **Copy format** shares only the FITLOG instructions.

### FITLOG at a glance

FITLOG is the plain-text format the AI uses to hand you a workout. It's wrapped in one block:

```text
[FITLOG:1]
... workout contents ...
[/FITLOG]
```

<!-- TODO: replace the placeholder above with a real, minimal example from the app
     (one strength exercise plus one run), and link to a full format spec if you have one. -->

If an import fails, see [troubleshooting](#faq-and-troubleshooting).

---

## Features

### Training

- **Strength logging**: sets, reps, loads, RPE/RIR, warm-ups, notes, and rest timing. Planned work stays separate from completed results.
- **Activities and mobility**: running, rucking, swimming, cycling, rowing, walking, hiking, circuits, FORCE, soccer, grappling, yoga, water polo, and more. Mobility plans can go movement by movement.
- **Readable intervals**: semicolon-separated run instructions display as stages.
- **HYROX simulation** *(optional)*: run-and-station timer with division selection.

### Insight

- **Strength profile**: compares recent completed bench, squat, deadlift, and overhead press results, with pull-ups shown separately. These are loose training guides, and the underlying sets and dates stay visible. Missing data does not mean a weakness.
- **Strength coverage**: shows which muscle groups received logged lifting work. It reflects training coverage, not recovery or physique.
- **Benchmarks**: pin repeatable tests, record dated attempts and protocols, and set optional re-test intervals (**Settings → Pinned benchmarks**).
- **Choose your display**: select Coach Loop lime, Rally peach, sky blue, or soft violet in **Settings → Appearance & quick log**. Pick which **Last 7 days** cards you want to see; these choices are separate from quick-log activities. At the bottom of **Progress**, tap **Modify Progress** to hide or show sections such as Lift balance. Hiding a section keeps its saved data.
- **Personalize Today**: choose and reorder quick-log activities in Settings → Appearance & quick log. Select the male or corrected female strength-coverage diagram there; the choice changes the illustration only.
- **Weekly streak**: five distinct completed training days in a Monday–Sunday week qualify. Tap the streak to open the training calendar.

### Data

- **JSON backup**: full, restorable copy of your data.
- **CSV export**: for spreadsheets and analysis (view only, not restorable).

---

## App sections

| Section | Use it to |
| --- | --- |
| **Today** | Start or resume a workout, preview saved plans, import a session, quick-log an activity, see upcoming events and your weekly streak. |
| **History** | Review past sessions and results. Edit a workout, including its date. |
| **Progress** | Explore exercise trends, records, bodyweight, recent activity, the training calendar, strength coverage, and strength profile. |
| **Coach** | Build context for an external AI chat, copy recent training or FITLOG instructions, and bring a workout plan back in. |
| **Settings** | Edit profile, ranked goals, units, and defaults. Manage benchmarks, muscle mappings, backups, exports, and offline status. |

<!-- TODO: screenshots table, one image per section. -->

---

## Your data, privacy and backups

> [!IMPORTANT]
> This GitHub Pages edition stores data **locally on your device**. It does **not** sync between phones, computers, or browsers. Another device means a separate log.

**Privacy**

- Your training is never sent to an AI automatically. You decide what to copy and share.
- The website is public, but every visitor gets their own local log.

**Backups**

- Use **Settings → Download full backup** regularly and store the JSON somewhere safe (Files, iCloud Drive).
- To move to another device, open Coach Loop there and choose **Restore JSON backup**. Restore **merges** data.
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

If you have a JSON backup, use **Settings → Restore JSON backup**. If a workout was accidentally deleted, enable **Recover deleted records with new IDs** in the restore preview. Ordinary restore preserves deletion protection. Without an external backup, data cleared from browser storage cannot be recovered, so back up regularly.
</details>

<details>
<summary><b>The AI forgot my background.</b></summary>

Start a new chat with **Start a new chat → Copy full context**.
</details>

---

## Updates

Open the app online periodically. Updates are checked on return to the foreground, or tap **Check updates** above the tabs.

When **Restart to update** appears, finish any active workout, close the editor and wait for **Saved on this device**. Tap it for one intentional restart. Another open Coach Loop window must be closed first. The app does not automatically restart during a workout.

The first upgrade from an older edition can still require closing all Safari and Home Screen windows, then reopening online, because that old edition lacks this button. Closing all windows remains a fallback if activation fails. Never clear website data to update: that deletes the local log.

Keep a current backup before moving to a different app address.

---

## Contributing

Bug reports and ideas are welcome. Please [open an issue](../../issues) and include your device, browser or OS version, and steps to reproduce. Do **not** attach personal backups or training data.

<!-- TODO: add contribution guidelines if you accept pull requests. -->

---

## Disclaimer

Coach Loop is a logging tool and a way to move text between you and an AI. It is not medical advice, a physical therapist, or a replacement for a qualified coach. AI-generated workouts can be wrong, so use your judgment, scale to how you feel, and talk to a professional about injuries or health concerns.

---

## Credits

<!-- TODO: choose a license (e.g. MIT) and add a LICENSE file, then update this section. -->

*Created using AI.*
