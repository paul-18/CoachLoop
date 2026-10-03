import { z } from "zod";
import type { TrainingState } from "../domain/training-types";

import { safeConflictPath } from "./conflict-path";
const finite = z.number().finite();
const nullableNumber = finite.nullable();
const loadNumber = finite.min(0).max(5000).nullable();
const identifier = z.string().min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const unit = z.enum(["lb", "kg"]);
const loadType = z.enum(["weighted", "bodyweight", "unrecorded"]);
const weightMode = z.enum(["total", "per_hand", "added"]);
const stringArray = z.array(z.string());
const timestamp = z.string();

const setSchema = z.object({
  id: identifier, plannedReps: z.string(), plannedWeight: loadNumber,
  plannedRpe: z.string(), plannedRir: z.string(), actualReps: z.string(),
  actualWeight: loadNumber, loadType, weightMode, unit,
  rpe: z.string(), rir: z.string(), completed: z.boolean(),
  completedAsPlanned: z.boolean(), warmup: z.boolean(), notes: z.string(),
  updatedAt: timestamp, skipped: z.boolean().optional(),
}).passthrough();
const exerciseSchema = z.object({
  id: identifier, name: z.string(), restSec: finite.nonnegative(), notes: z.string(),
  coachNotes: z.string(), sets: z.array(setSchema), deletedSetIds: stringArray.optional(),
  updatedAt: timestamp, substitutedFor: z.string().optional(),
}).passthrough();
const moveSchema = z.object({ id: identifier, name: z.string(), prescription: z.string() });
const effortSchema = z.object({
  id: identifier, plannedDistanceM: nullableNumber, actualDistanceM: nullableNumber,
  plannedDurationSec: nullableNumber, actualDurationSec: nullableNumber,
  plannedLoad: loadNumber, actualLoad: loadNumber, completed: z.boolean(),
});
const activitySchema = z.object({
  id: identifier, name: z.string(),
  externalSourceId: z.string().optional(),
  activityType: z.enum(["run", "swim", "water_polo", "bike", "row", "walk", "hike", "ruck", "mobility", "circuit", "force", "soccer", "grappling", "yoga", "other"]),
  loggingStyle: z.enum(["single", "routine", "efforts"]).optional(),
  efforts: z.array(effortSchema).optional(), effortRestSec: finite.nonnegative().optional(), effortLoadUnit: unit.optional(),
  plannedDurationMin: nullableNumber, actualDurationMin: nullableNumber,
  plannedDistanceKm: nullableNumber, actualDistanceKm: nullableNumber,
  ruckLoad: loadNumber, ruckLoadUnit: unit, averageHr: nullableNumber,
  elevationM: nullableNumber, pace: z.string(), intensity: z.string(), intervals: z.string(),
  mobilityMoves: z.array(moveSchema), effort: z.string(), notes: z.string(),
  coachNotes: z.string(), completed: z.boolean(), completedAsPlanned: z.boolean(),
  updatedAt: timestamp,
}).passthrough();
const segmentSchema = z.object({
  id: identifier, kind: z.enum(["run", "station"]), name: z.string(),
  distanceM: nullableNumber, reps: nullableNumber, loadKg: nullableNumber,
  loadCount: finite, targetM: nullableNumber, cue: z.string(), splitMs: nullableNumber,
  corrected: z.boolean().optional(),
});
const hyroxSchema = z.object({
  version: z.literal(1), division: z.enum(["men_open", "women_open", "men_pro", "women_pro"]),
  season: z.string(), setupLabel: z.string().optional(), focused: z.boolean().optional(),
  segments: z.array(segmentSchema), runningSince: nullableNumber,
  segmentElapsedMs: finite, started: z.boolean(), modified: z.boolean(),
  paused: z.boolean(), endedEarly: z.boolean(),
});
const workoutSchema = z.object({
  id: identifier, name: z.string(), date, timezone: z.string(), createdAt: timestamp,
  startedAt: timestamp.nullable(), completedAt: timestamp.nullable(),
  skippedAt: timestamp.nullable(), skipReason: z.string(),
  status: z.enum(["planned", "active", "completed", "skipped"]),
  exercises: z.array(exerciseSchema), cardio: z.array(activitySchema),
  deletedExerciseIds: stringArray.optional(), deletedActivityIds: stringArray.optional(),
  blockOrder: z.array(z.object({ type: z.enum(["exercise", "activity"]), id: identifier })),
  notes: z.string(), sessionRpe: z.string(),
  source: z.enum(["manual", "fitlog", "repeat", "history"]),
  importWarnings: stringArray.optional(), importFingerprint: z.string().optional(),
  originKey: z.string().optional(), updatedAt: timestamp.optional(), hyrox: hyroxSchema.optional(),
}).passthrough();
const checkInSchema = z.object({ date: z.string(), energy: z.string(), sleep: z.string(), soreness: z.string(), restrictions: z.string(), schedule: z.string() });
const conflictSchema = z.object({
  id: identifier, recordId: identifier, fieldPath: z.string().min(1).refine(safeConflictPath),
  base: z.unknown(), remoteValue: z.unknown(), raisingDeviceId: identifier,
  raisingDeviceValue: z.unknown(), createdAt: timestamp,
});

/** The complete schema used at the cloud boundary and after legacy migration. */
export const storedStateBoundary = z.object({
  version: z.literal(1), workouts: z.array(workoutSchema),
  bodyweightEntries: z.array(z.object({ id: identifier, date, weight: finite.positive(), unit, updatedAt: timestamp })),
  benchmarks: z.array(z.object({ id: identifier, name: z.string().min(1), protocol: z.string(), result: z.string(), testedOn: date.nullable(), attempts: z.array(z.object({ id: identifier, date, result: z.string().min(1), protocol: z.string(), updatedAt: timestamp })).optional(), retestDays: finite.int().min(7).max(365).nullable(), updatedAt: timestamp, deletedAt: timestamp.optional() })).optional(),
  waistEntries: z.array(z.object({ id: identifier, date, cm: finite.positive(), updatedAt: timestamp, deletedAt: timestamp.optional() })).optional(),
  loadIncrements: z.record(z.string(), z.object({ value: finite.nonnegative(), updatedAt: timestamp })).optional(),
  deletedWorkoutIds: stringArray, activeWorkoutId: identifier.nullable(),
  goals: stringArray, goalsUpdatedAt: timestamp, coachProfile: z.string(), coachProfileUpdatedAt: timestamp,
  exerciseAliases: z.record(z.string(), z.string()),
  exerciseMuscleOverrides: z.record(z.string(), z.object({
    primary: stringArray, secondary: stringArray.optional(), updatedAt: timestamp.optional(), deletedAt: timestamp.optional(),
  })),
  scheduleContext: z.object({
    events: z.array(z.object({ id: identifier, date, label: z.string(), updatedAt: timestamp.optional(), deletedAt: timestamp.optional() })),
    phases: z.array(z.object({ id: identifier, start: date, end: date, label: z.string(), updatedAt: timestamp.optional(), deletedAt: timestamp.optional() })),
  }),
  settings: z.object({
    bodyDiagram: z.enum(["male", "female"]).optional(),
    quickLogActivities: z.array(z.enum(["run", "swim", "bike", "ruck", "circuit", "soccer", "grappling", "yoga", "water_polo"])).refine(values => new Set(values).size === values.length, "Quick log choices must be unique").optional(),
    defaultUnit: unit, defaultRestSec: finite.nonnegative(), barWeightLb: finite.nonnegative(), barWeightKg: finite.nonnegative(),
    lastBackupAt: timestamp.nullable(), installedHintDismissed: z.boolean(),
    coachCheckIn: checkInSchema, lastCoachBriefAt: timestamp.nullable(),
  }),
  settingsUpdatedAt: timestamp,
  pendingConflicts: z.array(conflictSchema).optional(), resolvedConflictIds: stringArray.optional(),
}).passthrough();

/** Before normalization, allow missing legacy optional fields, but never malformed nesting. */
const legacyStateBoundary = z.object({
  version: z.literal(1), goals: stringArray,
  workouts: z.array(z.object({
    id: identifier, date, exercises: z.array(z.object({
      id: identifier, name: z.string(), sets: z.array(z.object({
        id: identifier, plannedReps: z.string(), actualReps: z.string(),
        plannedWeight: loadNumber, actualWeight: loadNumber,
        completed: z.boolean(), rpe: z.string(), rir: z.string(),
      }).passthrough()),
    }).passthrough()),
    cardio: z.array(z.object({ id: identifier }).passthrough()),
  }).passthrough()),
}).passthrough();

export const validateLocalState = (raw: unknown): TrainingState =>
  legacyStateBoundary.parse(raw) as unknown as TrainingState;

export const validateSyncedState = (raw: unknown): TrainingState =>
  storedStateBoundary.parse(raw) as TrainingState;
