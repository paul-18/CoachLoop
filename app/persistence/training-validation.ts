import { z } from "zod";
import { COLOR_THEMES, type ColorTheme } from "../domain/display-preferences";
import type { TrainingState, WorkoutSession } from "../domain/training-types";

import { safeConflictPath } from "./conflict-path";
const finite = z.number().finite();
const nullableNumber = finite.nonnegative().nullable();
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
const timestamp = z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString());

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
  version: z.literal(1), evidenceVersion: z.literal(2).optional(), workouts: z.array(workoutSchema),
  bodyweightEntries: z.array(z.object({ id: identifier, date, weight: finite.positive(), unit, updatedAt: timestamp })),
  nutritionLogs: z.array(z.object({
    date, targetKcal: finite.nonnegative(),
    meals: z.array(z.object({ id: identifier, name: z.string(), kcal: finite.nonnegative().max(20000), proteinG: finite.nonnegative().optional() })),
  })),
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
    colorTheme: z.enum(COLOR_THEMES.map(theme => theme.id) as [ColorTheme, ...ColorTheme[]]).optional(),
    weeklyCards: z.array(z.enum(["strength", "run", "ruck", "water_polo", "circuit", "swim", "bike", "row", "walk", "hike", "soccer", "grappling", "yoga", "mobility", "force", "other"])).refine(values => new Set(values).size === values.length).optional(),
    progressSections: z.array(z.enum(["weekly", "coverage", "balance", "bodyweight", "trends", "benchmarks", "activities", "waist", "monthly", "calendar", "records"])).refine(values => new Set(values).size === values.length).optional(),
    bodyDiagram: z.enum(["male", "female"]).optional(),
    quickLogActivities: z.array(z.enum(["run", "swim", "bike", "ruck", "circuit", "soccer", "grappling", "yoga", "water_polo"])).refine(values => new Set(values).size === values.length, "Quick log choices must be unique").optional(),
    defaultUnit: unit, defaultRestSec: finite.nonnegative(), barWeightLb: finite.nonnegative(), barWeightKg: finite.nonnegative(),
    dailyKcalTarget: finite.nonnegative().optional(),
    lastBackupAt: timestamp.nullable(), installedHintDismissed: z.boolean(),
    coachCheckIn: checkInSchema, lastCoachBriefAt: timestamp.nullable(),
    aiProvider: z.enum(["openrouter", "openai", "gemini", "groq", "custom"]).optional(),
    aiApiKey: z.string().optional(), aiModel: z.string().optional(), aiBaseUrl: z.string().optional(),
  }),
  settingsUpdatedAt: timestamp,
  pendingConflicts: z.array(conflictSchema).optional(), resolvedConflictIds: stringArray.optional(),
}).passthrough();

/** Before normalization, allow missing legacy optional fields, but never malformed nesting. */
const legacyStateBoundary = z.object({
  version: z.literal(1), evidenceVersion: z.union([z.literal(1), z.literal(2)]).optional(), goals: stringArray,
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

const unique = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} IDs`); };
const disjoint = (live: string[], deleted: string[] = [], label: string) => {
    const tombstones = new Set(deleted);
    const overlap = live.find(id => tombstones.has(id));
    if (overlap) throw new Error(`${label} ${overlap}: live record is also marked deleted. Keep the original backup for recovery.`);
};
function validateWorkoutIntegrity(w: WorkoutSession) {
  disjoint(w.exercises.map(e => e.id), w.deletedExerciseIds, "Exercise");
  disjoint(w.cardio.map(a => a.id), w.deletedActivityIds, "Activity");
  unique([...w.exercises, ...w.cardio].map(b => b.id), "block");
  const blocks = new Set([...w.exercises, ...w.cardio].map(b => b.id));
  unique(w.blockOrder.map(b => b.id), "block order");
  if (w.blockOrder.some(b => !blocks.has(b.id) || !(b.type === "exercise" ? w.exercises : w.cardio).some(x => x.id === b.id))) throw new Error("Invalid workout block reference");
  for (const exercise of w.exercises) {
    disjoint(exercise.sets.map(s => s.id), exercise.deletedSetIds, "Set");
    unique(exercise.sets.map(s => s.id), "set");
    if (exercise.sets.some(s => s.completed && s.skipped)) throw new Error("A set cannot be completed and skipped");
  }
  for (const activity of w.cardio) unique((activity.efforts ?? []).map(e => e.id), "effort");
}
function validateStateIntegrity(state: TrainingState) {
  unique(state.workouts.map(w => w.id), "workout");
  disjoint(state.workouts.map(w => w.id), state.deletedWorkoutIds, "Workout");
  unique(state.bodyweightEntries.map(e => e.id), "bodyweight");
  unique(state.bodyweightEntries.map(e => e.date), "bodyweight date");
  unique(state.nutritionLogs.map(e => e.date), "nutrition date");
  unique((state.waistEntries ?? []).map(e => e.id), "waist");
  unique((state.benchmarks ?? []).map(e => e.id), "benchmark");
  for (const b of state.benchmarks ?? []) unique((b.attempts ?? []).map(a => a.id), "benchmark attempt");
  if (state.activeWorkoutId && !state.workouts.some(w => w.id === state.activeWorkoutId && w.status === "active")) throw new Error("Active workout reference is invalid");
}
export const validateSyncedState = (raw: unknown): TrainingState => {
  const state = storedStateBoundary.parse(raw) as TrainingState;
  validateStateIntegrity(state);
  state.workouts.forEach(validateWorkoutIntegrity);
  return state;
};

/** Only this module can admit immutable candidates to the internal save path.
 * Imported/loaded/restored data and final confirmations still use the full
 * validator. Unchanged workout objects are reused only after deep freezing. */
declare const validatedBrand: unique symbol;
export type ValidatedState = TrainingState & { readonly [validatedBrand]: true };
const admittedStates = new WeakSet<object>();
const admittedWorkouts = new WeakSet<object>();
const frozenObjects = new WeakSet<object>();
function freezeJson(value: unknown): void {
  if (!value || typeof value !== "object" || frozenObjects.has(value)) return;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error("Training data must contain plain records, not mutable class instances");
  Object.values(value).forEach(freezeJson);
  Object.freeze(value); frozenObjects.add(value);
}
function admit(state: TrainingState): ValidatedState {
  freezeJson(state);
  state.workouts.forEach(w => admittedWorkouts.add(w));
  admittedStates.add(state);
  return state as ValidatedState;
}
export function assertValidatedState(state: TrainingState): asserts state is ValidatedState {
  if (!admittedStates.has(state)) throw new Error("Internal save requires a validated immutable candidate");
}
export const validatedState = (raw: unknown): ValidatedState => admit(validateSyncedState(raw));
const workoutList = z.array(z.unknown());
export function validateStateEdit(current: ValidatedState, candidate: TrainingState): ValidatedState {
  assertValidatedState(current);
  if (candidate === current) return current;
  // Check every non-workout section and all cross-record references on each edit.
  const state = storedStateBoundary.parse({ ...candidate, workouts: [] }) as TrainingState;
  state.workouts = workoutList.parse(candidate.workouts).map(raw => {
    if (raw && typeof raw === "object" && admittedWorkouts.has(raw)) return raw as WorkoutSession;
    const workout = workoutSchema.parse(raw) as WorkoutSession;
    validateWorkoutIntegrity(workout);
    return workout;
  });
  validateStateIntegrity(state);
  return admit(state);
}
