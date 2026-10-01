import { z } from "zod";
import {
  localDate,
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

export const FITLOG_INSTRUCTIONS = `Return the final workout inside one FITLOG block. Do not change the field names or separators.

[FITLOG:1]
WORKOUT|Workout name|YYYY-MM-DD

EXERCISE|Exercise name
SET|reps or rep range|weight and unit or Bodyweight|RPE or RIR target|optional WARMUP
REST|seconds
NOTES|optional exercise instructions

CARDIO|Activity name
TYPE|run, swim, bike, row, walk, hike, ruck, mobility, circuit, force, soccer, grappling, yoga, or other
DURATION|minutes
DISTANCE|kilometres
INTENSITY|easy, moderate, hard, pace, or zone
INTERVALS|optional interval details; for runs, separate warm-up, repeats/recovery, and cool-down with semicolons
RUCKLOAD|weight and unit (ruck only)
EFFORT|distance m|load lb or kg|target seconds (optional; repeat for drags, carries, sleds, sprints)
REST|seconds (after repeated efforts only)
HR|target average heart rate in bpm (optional)
ELEVATION|target total ascent in metres (optional)
PACE|target pace (optional)
NOTES|optional activity instructions

For a stretching or mobility routine, prefer this structured form instead of putting every movement in INTERVALS:
MOBILITY|Routine name
DURATION|minutes
MOVE|Movement name|sets, reps, or time
MOVE|Movement name|sets, reps, or time
NOTES|optional coach instructions
[/FITLOG]

Repeat blocks in performance order; use one SET line per prescribed set. Use EFFORT only for repeated drags, carries, sled work, or sprints; ordinary cardio uses DURATION and DISTANCE. For an interval run, write one INTERVALS line like "10 min easy; 6 × 400 m @ 1:45 with 90 sec jog; 10 min easy". DURATION and DISTANCE describe the whole run, not one repeat. Omit optional lines that have no value. For loads, write 20 lb each, 40 lb total, or 45 lb added as appropriate. Use Bodyweight only for unweighted bodyweight sets; leave the load blank if external weight is unspecified. Write RPE 7-8 or RIR 2 explicitly, or leave effort blank. NOTES are coach instructions, kept separate from the athlete's notes.`;

export const FITLOG_REMINDER = `Return one [FITLOG:1] ... [/FITLOG] block, in performance order, starting WORKOUT|name|YYYY-MM-DD.
Strength: EXERCISE|name, one SET|reps|load|RPE 7-8 or RIR 2|optional WARMUP per set, REST|seconds, NOTES|coach instructions. Loads need lb/kg and total/each/added where relevant; use Bodyweight or blank unspecified load.
Activities: CARDIO|name, TYPE|run/ruck/bike/swim/row/walk/hike/circuit/mobility/force/soccer/grappling/yoga/other, DURATION|minutes, DISTANCE|km, INTENSITY|description. For interval runs, INTERVALS|warm-up; repeats and recovery; cool-down, with whole-run DURATION/DISTANCE. RUCKLOAD|weight lb/kg when prescribed. Repeated efforts: EFFORT|20 m|90 lb|10 sec (one per effort), REST|seconds. Stretching: MOBILITY|name, MOVE|movement|prescription. Omit empty optional lines. NOTES remain coach instructions, separate from the athlete's notes.`;

export const exampleFitlog = `[FITLOG:1]
WORKOUT|Upper Strength + Easy Bike|${localDate()}

EXERCISE|Barbell Bench Press
SET|6|175 lb|RPE 7-8
SET|6|175 lb|RPE 7-8
SET|6|175 lb|RPE 8
SET|6|175 lb|RPE 8
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
  const cleanedSource = normalizedFitlogText(source);
  const blocks = [...cleanedSource.matchAll(/\[FITLOG:1\]([\s\S]*?)\[\/FITLOG\]/gi)];
  const openingTags = cleanedSource.match(/\[FITLOG:1\]/gi) ?? [];
  if (blocks.length !== 1 || openingTags.length !== 1) {
    throw new Error("Paste exactly one complete FITLOG workout at a time.");
  }

  const lines = blocks[0][1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const workoutHeaders = lines.filter((line) => /^WORKOUT\|/i.test(line));
  if (workoutHeaders.length !== 1) {
    throw new Error("Each FITLOG block must contain exactly one WORKOUT line.");
  }

  let name = "Imported workout";
  let date = localDate();
  const exercises: ExerciseBlock[] = [];
  const cardio: CardioEntry[] = [];
  const blockOrder: WorkoutSession["blockOrder"] = [];
  const warnings: string[] = [];
  let currentExercise: ExerciseBlock | null = null;
  let currentCardio: CardioEntry | null = null;
  const appendCoachNote = (current: ExerciseBlock | CardioEntry, note: string) => {
    current.coachNotes = [current.coachNotes, note].filter(Boolean).join(" ");
  };

  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim());
    const command = parts.shift()?.toUpperCase();
    const value = parts.join("|").trim();

    if (command === "WORKOUT") {
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
      const weightText = parts[1] || "";
      const effort = parts[2] || "";
      const effortTarget = parseEffortTarget(effort);
      const addedBodyweight = /body\s*weight\s*\+\s*\d/i.test(weightText);
      const isBodyweight = !addedBodyweight && /body\s*weight|^bw$/i.test(weightText);
      const loadMatch = isBodyweight || !weightText.trim() ? null : loadPattern.exec(weightText.trim());
      if (!isBodyweight && weightText.trim() && !loadMatch) {
        throw new Error(`SET: use Bodyweight or a load such as 175 lb, 80 kg, 40 lb each, or Bodyweight + 45 lb.`);
      }
      const unit: Unit = loadMatch
        ? /^kg$/i.test(loadMatch[2]) ? "kg" : "lb"
        : defaultUnit;
      const numericWeight = loadMatch ? Number(loadMatch[1]) : null;
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
      currentExercise.sets.push(
        makeSet(unit, {
          plannedReps: reps,
          plannedWeight: numericWeight,
          loadType: isBodyweight ? "bodyweight" : numericWeight === null ? "unrecorded" : "weighted",
          weightMode,
          ...effortTarget,
          warmup: parts.some((part) => /warm\s*up/i.test(part)),
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
      if (unit && (currentCardio.efforts?.length ?? 0) && currentCardio.effortLoadUnit !== unit) {
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
      cardio.push(currentCardio);
      blockOrder.push({ type: "activity", id: currentCardio.id });
      currentExercise = null;
    } else if (command === "MOBILITY") {
      currentCardio = makeCardio("mobility", value || "Mobility");
      cardio.push(currentCardio);
      blockOrder.push({ type: "activity", id: currentCardio.id });
      currentExercise = null;
    } else if (command === "TYPE" && currentCardio) {
      currentCardio.activityType = normalizeType(value);
      currentCardio.loggingStyle = makeCardio(currentCardio.activityType).loggingStyle;
    } else if (command === "DURATION" && currentCardio) {
      currentCardio.plannedDurationMin = parseNonNegativeNumber(value, "DURATION");
    } else if (command === "DISTANCE" && currentCardio) {
      currentCardio.plannedDistanceKm = parseNonNegativeNumber(value, "DISTANCE");
    } else if (command === "RUCKLOAD" && currentCardio) {
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
      if (currentExercise) appendCoachNote(currentExercise, value);
      if (currentCardio) appendCoachNote(currentCardio, value);
    } else if (command) {
      warnings.push(`Ignored FITLOG line: ${command}`);
    }
  }

  for (const exercise of exercises) {
    if (!exercise.sets.length) {
      throw new Error(`${exercise.name} has no SET lines.`);
    }
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

  parsedWorkoutSchema.parse(workout);
  return workout;
};
