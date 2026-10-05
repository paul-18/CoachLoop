import { validRepTarget } from "../domain/rep-target";
import { z } from "zod";
import { validateSyncedState } from "../persistence/training-validation";
import {
  localDate,
  defaultState,
  makeCardio,
  makeSet,
  uid,
  type CardioEntry,
  type ExerciseBlock,
  type Unit,
  type WorkoutSession,
} from "../domain/training-types";
import { validMeasurementDate } from "../domain/training-workflow";

const normalizedFitlogText = (source: string) => source
  .replace(/\u00a0/g, " ")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, "-");

const exerciseKey = (name: string) => name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

/** Stable enough to warn about an exact accidental re-paste; it is not a security hash. */
export const fitlogFingerprint = (source: string) => {
  const match = normalizedFitlogText(source).match(/\[FITLOG:1\]([\s\S]*?)\[\/FITLOG\]/i);
  const value = (match?.[0] ?? source).replace(/\s+/g, " ").trim().toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fitlog-${(hash >>> 0).toString(16)}`;
};

const parsedWorkoutSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exercises: z.array(z.object({ name: z.string().min(1), sets: z.array(z.any()) })),
  cardio: z.array(z.object({ name: z.string().min(1) })),
});

const parseNonNegativeNumber = (value: string, field: string): number | null => {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error(`${field}: expected one non-negative number.`);
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new Error(`${field}: number is outside the supported range.`);
  }
  return number;
};

const normalizeType = (name: string): CardioEntry["activityType"] => {
  const value = name.toLowerCase();
  if (/water[ _-]?polo/.test(value)) return "water_polo";
  if (value.includes("swim")) return "swim";
  if (value.includes("bike") || value.includes("cycl")) return "bike";
  if (value.includes("row")) return "row";
  if (value.includes("walk")) return "walk";
  if (value.includes("hike")) return "hike";
  if (value.includes("ruck")) return "ruck";
  if (value.includes("mobility") || value.includes("stretch")) return "mobility";
  if (value.includes("yoga")) return "yoga";
  if (value.includes("force")) return "force";
  if (value.includes("soccer") || value.includes("football")) return "soccer";
  if (value.includes("grappl") || value.includes("wrestl") || value.includes("jiu jitsu")) return "grappling";
  if (value.includes("circuit")) return "circuit";
  if (value.includes("run") || value.includes("jog")) return "run";
  return "other";
};

const parseMobilityMove = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)(?:\s+[-—:]?\s*)((?:\d+\s*[x×]\s*.+)|(?:\d+(?:\.\d+)?\s*(?:sec|secs|seconds|min|mins|minutes)(?:\/side)?))$/i);
  return {
    id: uid("move"),
    name: match?.[1]?.trim() || trimmed || "Movement",
    prescription: match?.[2]?.trim() || "",
  };
};

const parseRestSeconds = (value: string) => {
  const text = value.trim();
  if (!text) return null;
  const clock = /^(\d+):([0-5]\d)$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const amount = /^(\d+(?:\.\d+)?)\s*(s|sec|seconds?|min|minutes?)?$/i.exec(text);
  if (!amount) {
    throw new Error("REST: use seconds, 2 min, or 1:30.");
  }
  return Number(amount[1]) * (/^min/i.test(amount[2] ?? "") ? 60 : 1);
};

const loadPattern = /^(?:body\s*weight\s*\+\s*)?(\d+(?:\.\d+)?)\s*(kg|lbs?)(?:\s+(total|combined|each|per hand|each hand|added))?$/i;
const ruckLoadPattern = /^(\d+(?:\.\d+)?)\s*(kg|lbs?)$/i;

const parseEffortTarget = (value: string) => {
  const text = value.trim();
  if (!text) return { plannedRpe: "", plannedRir: "" };
  const match = /^(RPE|RIR)\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/i.exec(text);
  if (!match || Number(match[2]) > 10 || (match[3] && (Number(match[3]) > 10 || Number(match[3]) < Number(match[2])))) {
    throw new Error("SET effort: use RPE 7-8 or RIR 2, or leave the field blank.");
  }
  const target = match[3] ? `${match[2]}-${match[3]}` : match[2];
  return /^rpe$/i.test(match[1])
    ? { plannedRpe: target, plannedRir: "" }
    : { plannedRpe: "", plannedRir: target };
};

export const FITLOG_OUTPUT_RULES = [
  "OUTPUT FORMAT — mandatory for every workout, including corrections:",
  "Return exactly one complete FITLOG workout inside one fenced plain-text code block: open with ```text and close with ``` on separate lines. Put any explanation outside that code block.",
  "Put [FITLOG:1] and [/FITLOG] on their own separate lines. Inside them, start with WORKOUT|name|YYYY-MM-DD.",
  "Put EVERY command on its own actual newline: WORKOUT, EXERCISE, SET, REST, NOTES, CARDIO, TYPE, EFFORT, MOBILITY, MOVE and every other field. Never combine commands into a paragraph. Visual word wrapping is not a newline; do not write literal \\n characters instead.",
  "Do not use bullets, tables or HTML inside the block. Do not put pipe characters inside names or notes. Preserve blank columns and their pipe separators.",
  "Before responding, check that every line has exactly one command and its permitted fields. On a correction, return the entire corrected multiline block, not a claim that it was fixed.",
].join("\n");

export const FITLOG_INSTRUCTIONS = `${FITLOG_OUTPUT_RULES}

Keep FITLOG version 1, field names and pipe separators. Blocks appear in performance order.

Common rules:
- These are prescriptions, never completed results. Do not invent unspecified loads, distances, times, HR or elevation.
- Omit optional lines with no value. Leave unused SET or EFFORT columns blank, preserving their pipe separators.
- Keep exercise names consistent between workouts. Preserve the exact variation (barbell, dumbbell, assisted, etc.).
- Make external loads explicit: 185 lb total, 40 lb each, or 25 lb added. Bodyweight means unweighted only. A blank load means unspecified.
- Give short technique cues in NOTES directly under their exercise/activity. They remain separate from the athlete's notes. Workout-level NOTES are not supported.
- Keep warm-ups minimal and clearly lighter than working sets; mark them WARMUP. General warm-up can be handled independently.

1. Strength — one SET line per prescribed set:
EXERCISE|Barbell Bench Press
SET|5|135 lb total||WARMUP
SET|6-8|185 lb total|RIR 2
SET|6-8|185 lb total|RIR 2
REST|180
NOTES|Keep the descent controlled.

SET|reps or rep range|load|RPE or RIR target|optional WARMUP
The SET reps column must contain ONLY a positive whole number or increasing range, such as 10 or 8-10. Never include "each side", "/side", seconds, units or other text in that column. Invalid example (do not output): SET|10 each side|10 lb total|RPE 7.
For unilateral work, use numeric reps per side and put the side instruction in NOTES:
EXERCISE|Pallof Press
SET|10|10 lb total|RPE 7
REST|45
NOTES|Perform 10 reps per side. Enter actual reps per side when logging.
Do not double 10 reps per side into 20. The app does not store a per-side multiplier; volume calculations use the entered numeric reps without automatically doubling them.
For a range, the athlete enters their actual reps when completing the set; the app does not guess. Effort examples: RPE 7-8 or RIR 2. REST accepts seconds, 2 min or 1:30. Use structured mobility for timed stretches/holds. Assisted lifting loads are not yet supported; do not encode assistance as added load.

2. Continuous cardio:
CARDIO|Easy run
TYPE|run
DURATION|30
INTENSITY|Easy conversational effort

TYPE accepts run, swim, water_polo, bike, row, walk, hike, ruck, mobility, circuit, force, soccer, grappling, yoga or other. DURATION is minutes; DISTANCE is kilometres, including swim/row. Both are optional targets. Rucking can add RUCKLOAD|45 lb. Optional coaching targets: HR|145, ELEVATION|100, PACE|5:30/km. Water polo, soccer, grappling, yoga and circuits usually need minutes and brief NOTES only.

3. Interval run — keep stages in one INTERVALS line:
CARDIO|Run intervals
TYPE|run
INTERVALS|10 min easy; 6 × 400 m @ 1:45 with 90 sec jog; 10 min easy
NOTES|Stay controlled on the first repeats.

Semicolons separate stages. DURATION and DISTANCE, when provided, describe the whole session including recovery and warm-up/cool-down. Never use one repeat's distance as the whole-run distance.

4. Repeated drags, carries, sled work or sprints:
CARDIO|Sandbag drag practice
TYPE|force
EFFORT|20 m|90 lb|10 sec
EFFORT|20 m|90 lb|10 sec
REST|120

EFFORT|distance m|load lb or kg|target seconds. One line per effort; leave unused columns blank. Use one load unit throughout the activity. Ordinary cardio and interval runs use their own forms above.

5. Mobility:
MOBILITY|Hip mobility
DURATION|8
MOVE|Adductor rock-back|2 × 8/side
MOVE|Hip flexor stretch|2 × 30 sec/side
NOTES|Use a comfortable range.

Use MOVE|movement|prescription for each movement. Do not bury a whole routine in one paragraph. Only include fields relevant to the requested workout. Wrap the chosen workout in one FITLOG block, not all of these examples.`;

export const FITLOG_REMINDER = `${FITLOG_OUTPUT_RULES}
Keep v1 fields and separators. Blocks appear in performance order. The examples below describe separate lines, not a semicolon-separated paragraph.
Strength: EXERCISE|consistent exact name; one SET|whole reps or range|explicit load|RPE 7-8 or RIR 2|optional WARMUP per set; REST|seconds. Loads: 185 lb total, 40 lb each, 25 lb added, Bodyweight, or blank if unspecified. Minimal lighter warm-ups. Rep ranges require actual reps during logging. Assistance loads are not supported.
SET reps must be ONLY a positive whole number or increasing range (10 or 8-10). Never write "10 each side", "10/side", seconds or other text in the reps column. For unilateral work, use SET|10|10 lb total|RPE 7 and NOTES|Perform 10 reps per side. Enter actual reps per side when logging. Do not double the numeric target; the app does not automatically double per-side reps in volume calculations.
Activities: CARDIO|name; TYPE|run/ruck/bike/swim/water_polo/row/walk/hike/circuit/mobility/force/soccer/grappling/yoga/other; optional DURATION|minutes, DISTANCE|km, INTENSITY|description. Runs: INTERVALS|warm-up; repeats and recovery; cool-down. Whole-session totals only. Ruck: RUCKLOAD|weight lb/kg. Repeated drags/carries/sprints: EFFORT|20 m|90 lb|10 sec, one line per effort; blank unused columns; same load unit; REST|seconds. Mobility: MOBILITY|name; MOVE|movement|prescription.
Omit unspecified targets instead of inventing them. Put short NOTES directly below their exercise/activity; no workout-level NOTES. Targets and coach cues never become actual results until accepted during logging.`;

export const exampleFitlog = `[FITLOG:1]
WORKOUT|Upper Strength + Easy Bike|${localDate()}

EXERCISE|Barbell Bench Press
SET|6|175 lb total|RPE 7-8
SET|6|175 lb total|RPE 7-8
SET|6|175 lb total|RPE 8
SET|6|175 lb total|RPE 8
REST|180

EXERCISE|Pull-Up
SET|6-10|Bodyweight|RIR 2
SET|6-10|Bodyweight|RIR 2
SET|6-10|Bodyweight|RIR 2
SET|6-10|Bodyweight|RIR 2
REST|120

CARDIO|Easy Cycling
TYPE|bike
DURATION|20
INTENSITY|Easy
[/FITLOG]`;

export const parseFitlog = (
  source: string,
  defaultUnit: Unit,
  aliases: Record<string, string>,
): WorkoutSession => {
  if (source.length > 250_000) throw new Error("This workout text is too large. Paste one workout at a time.");
  const cleanedSource = normalizedFitlogText(source);
  // Version dispatch applies only to new imports. Stored workouts are structured
  // evidence and must never be reparsed using this or a future FITLOG grammar.
  const versions = [...cleanedSource.matchAll(/\[FITLOG:([^\]]+)\]/gi)].map((match) => match[1]);
  if (versions.some((version) => version !== "1")) throw new Error("This app currently accepts FITLOG version 1. Your saved history is unchanged.");
  const blocks = [...cleanedSource.matchAll(/\[FITLOG:1\]([\s\S]*?)\[\/FITLOG\]/gi)];
  const openingTags = cleanedSource.match(/\[FITLOG:1\]/gi) ?? [];
  if (blocks.length !== 1 || openingTags.length !== 1) {
    throw new Error("Paste exactly one complete FITLOG workout at a time.");
  }

  const firstLine = cleanedSource.slice(0, blocks[0].index! + "[FITLOG:1]".length).split(/\r?\n/).length;
  const lines = blocks[0][1]
    .split(/\r?\n/)
    .map((line, index) => ({ text: line.trim(), number: firstLine + index }))
    .filter((line) => line.text);
  const workoutHeaders = lines.filter((line) => /^WORKOUT\|/i.test(line.text));
  if (workoutHeaders.length !== 1) {
    throw new Error("Each FITLOG block must contain exactly one WORKOUT line.");
  }
  if (lines[0] !== workoutHeaders[0]) throw new Error(`Line ${lines[0]?.number}: WORKOUT must be the first line inside FITLOG.`);

  let name = "Imported workout";
  let date = localDate();
  const exercises: ExerciseBlock[] = [];
  const cardio: CardioEntry[] = [];
  const blockOrder: WorkoutSession["blockOrder"] = [];
  const warnings: string[] = [];
  const warnedLoadSemantics = new Set<string>();
  let currentExercise: ExerciseBlock | null = null;
  let currentCardio: CardioEntry | null = null;
  const scalarFields = new Set<string>();
  const inferredActivities: { activity: CardioEntry; line: number; explicit: boolean }[] = [];
  const appendCoachNote = (current: ExerciseBlock | CardioEntry, note: string) => {
    current.coachNotes = [current.coachNotes, note].filter(Boolean).join(" ");
  };

  for (const line of lines) {
    const parts = line.text.split("|").map((part) => part.trim());
    const command = parts.shift()?.toUpperCase();
    const value = parts.join("|").trim();

    try {
      const arity: Record<string, number> = { WORKOUT: 2, EXERCISE: 1, CARDIO: 1, MOBILITY: 1, MOVE: 2, REST: 1, TYPE: 1, DURATION: 1, DISTANCE: 1, RUCKLOAD: 1, HR: 1, ELEVATION: 1, PACE: 1, INTENSITY: 1, INTERVALS: 1, NOTES: 1 };
      const maxFields = command === "SET" ? 4 : command === "EFFORT" ? 3 : arity[command ?? ""];
      // Diagnose joined structured commands; never guess where free-text notes end.
      if (maxFields !== undefined && parts.length > maxFields && !["NOTES", "INTERVALS", "MOVE"].includes(command ?? "") && /\s(?:WORKOUT|EXERCISE|SET|REST|NOTES|CARDIO|TYPE|EFFORT|MOBILITY|MOVE|DURATION|DISTANCE|INTENSITY|RUCKLOAD|HR|ELEVATION|PACE|INTERVALS)\|/i.test(line.text)) {
        throw new Error("Multiple FITLOG commands appear on one line. Each command needs an actual newline, not visual word wrapping. Ask your AI for the complete workout in a multiline text code block and copy it using the code block's Copy button.");
      }
      if (command && arity[command] !== undefined && parts.length !== arity[command]) throw new Error(`${command}: expected ${arity[command]} pipe-separated field${arity[command] === 1 ? "" : "s"}. Do not put pipe characters inside text.`);
      if (["EXERCISE", "CARDIO", "MOBILITY"].includes(command ?? "")) scalarFields.clear();
      if (command && ["TYPE", "DURATION", "DISTANCE", "RUCKLOAD", "HR", "ELEVATION", "PACE", "INTENSITY", "INTERVALS"].includes(command) && currentCardio) {
        if (scalarFields.has(command)) throw new Error(`${command}: this field was already supplied for this activity. Use one value.`);
        scalarFields.add(command);
      }
      if (command === "WORKOUT") {
        if (!parts[0]) throw new Error("WORKOUT: enter a workout name");
        const importedDate = parts[1] ?? "";
        if (!validMeasurementDate(importedDate)) {
          throw new Error("WORKOUT: use a valid calendar date in YYYY-MM-DD format.");
        }
        name = parts[0]?.trim() || "Imported workout";
        date = importedDate;
        currentExercise = null;
        currentCardio = null;
      } else if (command === "EXERCISE") {
        const rawName = value || "Exercise";
        const canonicalName = aliases[rawName.toLowerCase()] ?? aliases[exerciseKey(rawName)] ?? rawName;
        currentExercise = {
          id: uid("exercise"),
          name: canonicalName,
          restSec: 120,
          notes: "",
          coachNotes: "",
          sets: [],
          updatedAt: new Date().toISOString(),
        };
        const exercise = currentExercise;
        exercises.push(exercise);
        blockOrder.push({ type: "exercise", id: exercise.id });
        currentCardio = null;
      } else if (command === "SET") {
        if (!currentExercise) {
          throw new Error("A SET line appeared before an EXERCISE line.");
        }
        const reps = parts[0] || "";
        if (!validRepTarget(reps)) throw new Error("SET: enter a rep target with positive whole reps or an increasing range, such as 6 or 6-8.");
        const repRange = /^(\d+)\s*-\s*(\d+)$/.exec(reps);
        if (repRange && (Number(repRange[1]) < 1 || Number(repRange[2]) < Number(repRange[1]))) throw new Error("SET: use an increasing positive rep range, such as 6-8.");
        if (parts.length > 4 || (parts[3] && !/^warm\s*up$/i.test(parts[3]))) throw new Error("SET: use reps|load|RPE or RIR|optional WARMUP. Put instructions on a NOTES line.");
        const weightText = parts[1] || "";
        const effort = parts[2] || "";
        const effortTarget = parseEffortTarget(effort);
        const addedBodyweight = /body\s*weight\s*\+\s*\d/i.test(weightText);
        const isBodyweight = !addedBodyweight && /^(?:body\s*weight|bw)$/i.test(weightText.trim());
        const loadMatch = isBodyweight || !weightText.trim() ? null : loadPattern.exec(weightText.trim());
        if (!isBodyweight && weightText.trim() && !loadMatch) {
          throw new Error(`SET: use Bodyweight or a load such as 175 lb, 80 kg, 40 lb each, or Bodyweight + 45 lb.`);
        }
        const unit: Unit = loadMatch
          ? /^kg$/i.test(loadMatch[2]) ? "kg" : "lb"
          : defaultUnit;
        const numericWeight = loadMatch ? Number(loadMatch[1]) : null;
        if (numericWeight !== null && (!Number.isFinite(numericWeight) || numericWeight < 0 || numericWeight > 5000)) throw new Error("SET load must be between 0 and 5000 lb/kg.");
        const loadMeaning = loadMatch?.[3] ?? "";
        const weightMode = /^(?:total|combined)$/i.test(loadMeaning)
          ? "total"
          : /^(?:each|per hand|each hand)$/i.test(loadMeaning)
            ? "per_hand"
              : /^added$/i.test(loadMeaning) || addedBodyweight
              ? "added"
              : /dumbbell|\bdb\b/i.test(currentExercise.name)
                ? "per_hand"
                : /weighted (dip|pull|chin)/i.test(currentExercise.name)
                  ? "added"
                  : "total";
        if (loadMatch && !loadMeaning && !addedBodyweight && !warnedLoadSemantics.has(currentExercise.id)) {
          warnedLoadSemantics.add(currentExercise.id);
          warnings.push(`Line ${line.number} · ${currentExercise.name}, set ${currentExercise.sets.length + 1}: loads without total/each/added (such as ${weightText}) are treated as ${weightMode === "per_hand" ? "per hand" : weightMode === "added" ? "added load" : "total load"}. Make the meaning explicit if this is wrong.`);
        }
        currentExercise.sets.push(
          makeSet(unit, {
            plannedReps: reps,
            plannedWeight: numericWeight,
            loadType: isBodyweight ? "bodyweight" : numericWeight === null ? "unrecorded" : "weighted",
            weightMode,
            ...effortTarget,
            warmup: !!parts[3] && /^warm\s*up$/i.test(parts[3]),
          }),
        );
      } else if (command === "REST" && currentExercise) {
        currentExercise.restSec = parseRestSeconds(value) ?? currentExercise.restSec;
      } else if (command === "REST" && currentCardio) {
        currentCardio.effortRestSec = parseRestSeconds(value) ?? 0;
      } else if (command === "EFFORT" && currentCardio) {
        const distance = parts[0] ? /^(\d+(?:\.\d+)?)\s*m$/i.exec(parts[0]) : null;
        const load = parts[1] ? ruckLoadPattern.exec(parts[1]) : null;
        const seconds = parts[2] ? /^(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)$/i.exec(parts[2]) : null;
        if ((parts[0] && !distance) || (parts[1] && !load) || (parts[2] && !seconds) || parts.length > 3 || (!distance && !load && !seconds)) {
          throw new Error("EFFORT: use metres, load with lb/kg, and optional seconds, such as EFFORT|20 m|90 lb|10 sec. Leave unused columns blank.");
        }
        const unit = load ? /^kg$/i.test(load[2]) ? "kg" : "lb" : null;
        if (unit && currentCardio.efforts?.some(e => e.plannedLoad !== null) && currentCardio.effortLoadUnit !== unit) {
          throw new Error("EFFORT: use the same load unit for every effort in an activity.");
        }
        if (unit) currentCardio.effortLoadUnit = unit;
        currentCardio.loggingStyle = "efforts";
        currentCardio.efforts = [...(currentCardio.efforts ?? []), {
          id: uid("effort"), plannedDistanceM: distance ? Number(distance[1]) : null,
          actualDistanceM: null, plannedLoad: load ? Number(load[1]) : null,
          actualLoad: null, plannedDurationSec: seconds ? Number(seconds[1]) : null,
          actualDurationSec: null, completed: false,
        }];
      } else if (command === "CARDIO") {
        currentCardio = makeCardio(normalizeType(value), value || "Cardio");
        inferredActivities.push({ activity: currentCardio, line: line.number, explicit: false });
        cardio.push(currentCardio);
        blockOrder.push({ type: "activity", id: currentCardio.id });
        currentExercise = null;
      } else if (command === "MOBILITY") {
        currentCardio = makeCardio("mobility", value || "Mobility");
        cardio.push(currentCardio);
        blockOrder.push({ type: "activity", id: currentCardio.id });
        currentExercise = null;
      } else if (command === "TYPE" && currentCardio) {
        const type = value.toLowerCase().replace(/[ -]/g, "_");
        const allowed = ["run", "swim", "water_polo", "bike", "row", "walk", "hike", "ruck", "mobility", "circuit", "force", "soccer", "grappling", "yoga", "other"];
        if (!allowed.includes(type)) throw new Error("TYPE: choose a supported activity such as run, water_polo, circuit, or ruck");
        if (currentCardio.ruckLoad !== null && type !== "ruck") throw new Error("TYPE conflicts with RUCKLOAD; use ruck");
        currentCardio.activityType = type as CardioEntry["activityType"];
        const inferred = inferredActivities.find(item => item.activity === currentCardio);
        if (inferred) inferred.explicit = true;
        currentCardio.loggingStyle = makeCardio(currentCardio.activityType).loggingStyle;
      } else if (command === "DURATION" && currentCardio) {
        currentCardio.plannedDurationMin = parseNonNegativeNumber(value, "DURATION");
      } else if (command === "DISTANCE" && currentCardio) {
        currentCardio.plannedDistanceKm = parseNonNegativeNumber(value, "DISTANCE");
      } else if (command === "RUCKLOAD" && currentCardio) {
        if (currentCardio.activityType !== "ruck" && currentCardio.activityType !== "other") throw new Error("RUCKLOAD is only valid for a ruck activity");
        const load = value ? ruckLoadPattern.exec(value) : null;
        if (value && !load) throw new Error("RUCKLOAD: use a non-negative number with lb or kg, such as 45 lb.");
        currentCardio.ruckLoad = load ? Number(load[1]) : null;
        currentCardio.ruckLoadUnit = load ? /^kg$/i.test(load[2]) ? "kg" : "lb" : defaultUnit;
        currentCardio.activityType = "ruck";
      } else if (command === "HR" && currentCardio) {
        const target = parseNonNegativeNumber(value, "HR");
        if (target !== null) appendCoachNote(currentCardio, `Target average HR: ${target} bpm.`);
      } else if (command === "ELEVATION" && currentCardio) {
        const target = parseNonNegativeNumber(value, "ELEVATION");
        if (target !== null) appendCoachNote(currentCardio, `Target total ascent: ${target} m.`);
      } else if (command === "PACE" && currentCardio) {
        if (value) appendCoachNote(currentCardio, `Target pace: ${value}.`);
      } else if (command === "INTENSITY" && currentCardio) {
        currentCardio.intensity = value;
      } else if (command === "INTERVALS" && currentCardio) {
        currentCardio.intervals = value;
        if (currentCardio.activityType === "mobility") {
          currentCardio.mobilityMoves = value.split(";").map(parseMobilityMove).filter((move) => move.name);
        }
      } else if (command === "MOVE" && currentCardio) {
        currentCardio.activityType = "mobility";
        currentCardio.mobilityMoves.push({
          id: uid("move"),
          name: parts[0] || "Movement",
          prescription: parts.slice(1).join("|").trim(),
        });
      } else if (command === "NOTES") {
        if (!currentExercise && !currentCardio && value) warnings.push(`Line ${line.number}: workout-level NOTES are not supported. Put this guidance below its EXERCISE, CARDIO or MOBILITY block.`);
        if (currentExercise) appendCoachNote(currentExercise, value);
        if (currentCardio) appendCoachNote(currentCardio, value);
      } else if (command) {
        if (["REST", "EFFORT", "TYPE", "DURATION", "DISTANCE", "RUCKLOAD", "HR", "ELEVATION", "PACE", "INTENSITY", "INTERVALS", "MOVE"].includes(command)) throw new Error(`${command}: this field is outside the block it belongs to.`);
        warnings.push(`Line ${line.number}: unsupported field ${command} was ignored. Check that no workout instructions were lost.`);
      }
    } catch (error) {
      const context = currentExercise ? `${currentExercise.name}${command === "SET" ? `, set ${currentExercise.sets.length + 1}` : ""}` : currentCardio?.name;
      throw new Error(`Line ${line.number}${context ? ` · ${context}` : ""}: ${error instanceof Error ? error.message : "This line could not be read."}`);
    }
  }

  for (const exercise of exercises) {
    if (!exercise.sets.length) {
      throw new Error(`${exercise.name} has no SET lines.`);
    }
  }
  for (const { activity, line, explicit } of inferredActivities) {
    if (!explicit) warnings.push(`Line ${line} · ${activity.name}: TYPE was omitted; activity type inferred as ${activity.activityType}. Check the preview or add TYPE explicitly (especially for run/walk or football).`);
  }

  if (!exercises.length && !cardio.length) {
    throw new Error("The FITLOG block did not contain an exercise or activity.");
  }

  const workout: WorkoutSession = {
    id: uid("workout"),
    name,
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    skipReason: "",
    status: "planned",
    exercises,
    cardio,
    blockOrder,
    notes: "",
    sessionRpe: "",
    source: "fitlog",
    importWarnings: warnings,
    importFingerprint: fitlogFingerprint(cleanedSource),
  };

  if (exercises.length + cardio.length > 100 || exercises.some((e) => e.sets.length > 100) || cardio.some((a) => (a.efforts?.length ?? 0) > 100)) throw new Error("This plan is too large. Import at most 100 blocks and 100 sets or efforts per block.");
  parsedWorkoutSchema.parse(workout);
  validateSyncedState({ ...defaultState(), workouts: [workout] });
  return workout;
};
