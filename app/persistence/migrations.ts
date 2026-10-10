import { defaultState, makeCardio, makeExercise, makeSet, type TrainingSet, type TrainingState, type LoadType, type WeightMode } from "../domain/training-types";
import { validMeasurementDate } from "../domain/training-workflow";
import { normalizeExerciseMuscleOverrides } from "../domain/training-coverage";
import { normalizedBlockOrder } from "../domain/block-order";
import { migrateAcceptedEvidence } from "./training-migrations";
import { validateLocalState, validateSyncedState } from "./training-validation";
import { selectedActiveWorkout } from "../domain/workout-transitions";

const inferredLoadType = (exerciseName: string, set: TrainingSet): LoadType => {
  if (set.loadType === "weighted" || set.loadType === "bodyweight" || set.loadType === "unrecorded") return set.loadType;
  if (typeof set.actualWeight === "number" || typeof set.plannedWeight === "number") return "weighted";
  return /bodyweight|push[ -]?up|pull[ -]?up|chin[ -]?up|leg raise|plank|dead bug/i.test(exerciseName)
    ? "bodyweight"
    : "unrecorded";
};

const inferredWeightMode = (exerciseName: string, set: TrainingSet): WeightMode => {
  if (set.weightMode === "total" || set.weightMode === "per_hand" || set.weightMode === "added") return set.weightMode;
  if (/weighted (dip|pull|chin)/i.test(exerciseName)) return "added";
  // Legacy Coach Loop entries stored one number without semantics. Preserve it as
  // a total rather than silently reinterpreting old dumbbell history as per-hand.
  return "total";
};

const normalizeLoadedState = (state: TrainingState): TrainingState => ({
  ...defaultState(),
  ...state,
  settings: {
    ...defaultState().settings,
    ...(state.settings ?? {}),
    coachCheckIn: {
      ...defaultState().settings.coachCheckIn,
      ...(state.settings?.coachCheckIn ?? {}),
    },
  },
  goals: Array.isArray(state.goals) ? state.goals : defaultState().goals,
  goalsUpdatedAt: typeof state.goalsUpdatedAt === "string" ? state.goalsUpdatedAt : defaultState().goalsUpdatedAt,
  coachProfile: typeof state.coachProfile === "string" ? state.coachProfile : "",
  coachProfileUpdatedAt: typeof state.coachProfileUpdatedAt === "string" ? state.coachProfileUpdatedAt : defaultState().coachProfileUpdatedAt,
  settingsUpdatedAt: typeof state.settingsUpdatedAt === "string" ? state.settingsUpdatedAt : defaultState().settingsUpdatedAt,
  workouts: Array.isArray(state.workouts)
    ? state.workouts.map((workout) => ({
        ...workout,
        timezone: workout.timezone || "UTC",
        updatedAt: workout.updatedAt ?? workout.completedAt ?? workout.skippedAt ?? workout.createdAt,
        skippedAt: workout.skippedAt ?? null,
        skipReason: workout.skipReason ?? "",
        exercises: workout.exercises.map((exercise) => ({
          ...makeExercise(state.settings?.defaultUnit ?? "lb", exercise.restSec),
          ...exercise,
          coachNotes: exercise.coachNotes ?? "",
          updatedAt: exercise.updatedAt ?? workout.updatedAt ?? workout.completedAt ?? workout.createdAt,
          sets: exercise.sets.map((set) => ({
            ...makeSet(set.unit ?? state.settings?.defaultUnit ?? "lb"),
            ...set,
            plannedRpe: set.plannedRpe ?? "",
            plannedRir: set.plannedRir ?? "",
            loadType: inferredLoadType(exercise.name, set),
            weightMode: inferredWeightMode(exercise.name, set),
            completedAsPlanned: set.completedAsPlanned === true,
            actualReps: set.actualReps ?? "",
            actualWeight: set.actualWeight ?? null,
            updatedAt: set.updatedAt ?? exercise.updatedAt ?? workout.updatedAt ?? workout.completedAt ?? workout.createdAt,
          })),
        })),
        cardio: workout.cardio.map((activity) => ({
          ...makeCardio(activity.activityType ?? "other"),
          ...activity,
          coachNotes: activity.coachNotes ?? "",
          mobilityMoves: Array.isArray(activity.mobilityMoves) ? activity.mobilityMoves : [],
          efforts: Array.isArray(activity.efforts) ? activity.efforts : [],
          effortRestSec: activity.effortRestSec ?? 0,
          effortLoadUnit: activity.effortLoadUnit === "kg" ? "kg" : "lb",
          ruckLoad: activity.ruckLoad ?? null,
          ruckLoadUnit: activity.ruckLoadUnit === "kg" ? "kg" : "lb",
          averageHr: activity.averageHr ?? null,
          elevationM: activity.elevationM ?? null,
          pace: activity.pace ?? "",
          completedAsPlanned: activity.completedAsPlanned === true,
          updatedAt: activity.updatedAt ?? workout.updatedAt ?? workout.completedAt ?? workout.createdAt,
        })),
        blockOrder: normalizedBlockOrder(workout),
      }))
    : [],
  bodyweightEntries: Array.isArray(state.bodyweightEntries)
    ? state.bodyweightEntries
      .map((entry) => ({ ...entry, updatedAt: entry.updatedAt ?? `${entry.date}T00:00:00.000Z` }))
    : [],
  nutritionLogs: Array.isArray(state.nutritionLogs) ? state.nutritionLogs : [],
  benchmarks: Array.isArray(state.benchmarks) ? state.benchmarks : [],
  waistEntries: Array.isArray(state.waistEntries) ? state.waistEntries.map(entry => ({ ...entry, updatedAt: entry.updatedAt ?? `${entry.date}T00:00:00.000Z` })) : [],
  loadIncrements: state.loadIncrements ?? {},
  deletedWorkoutIds: Array.isArray(state.deletedWorkoutIds) ? state.deletedWorkoutIds : [],
  pendingConflicts: Array.isArray(state.pendingConflicts) ? state.pendingConflicts : [],
  resolvedConflictIds: Array.isArray(state.resolvedConflictIds) ? state.resolvedConflictIds : [],
  exerciseAliases: state.exerciseAliases ?? defaultState().exerciseAliases,
  exerciseMuscleOverrides: normalizeExerciseMuscleOverrides(state.exerciseMuscleOverrides),
  scheduleContext: {
    events: Array.isArray(state.scheduleContext?.events) ? state.scheduleContext.events : [],
    phases: Array.isArray(state.scheduleContext?.phases) ? state.scheduleContext.phases : [],
  },
});

export const prepareLoadedState = (raw: unknown): TrainingState => {
  const accepted = validateLocalState(raw);
  const currentFormat = accepted.evidenceVersion === 2;
  if (accepted.bodyweightEntries?.some(e => !e || !Number.isFinite(e.weight) || e.weight <= 0 || !validMeasurementDate(e.date) || !["lb", "kg"].includes(e.unit) || ((currentFormat || e.updatedAt !== undefined) && typeof e.updatedAt !== "string"))) throw new Error("Invalid bodyweight record: check weight, date, lb/kg unit and updatedAt timestamp");
  if (accepted.waistEntries?.some(e => !e || !Number.isFinite(e.cm) || e.cm <= 0 || !validMeasurementDate(e.date) || ((currentFormat || e.updatedAt !== undefined) && typeof e.updatedAt !== "string"))) throw new Error("Invalid waist record: check measurement, date and updatedAt timestamp");
  if (Array.isArray(accepted.nutritionLogs) && accepted.nutritionLogs.some(e => !e || !validMeasurementDate(e.date) || !Number.isFinite(e.targetKcal) || e.targetKcal < 0 || !Array.isArray(e.meals) || e.meals.some(m => !m || typeof m.id !== "string" || !m.id || typeof m.name !== "string" || !Number.isFinite(m.kcal) || m.kcal < 0 || m.kcal > 20000 || (m.proteinG !== undefined && (!Number.isFinite(m.proteinG) || m.proteinG < 0))))) throw new Error("Invalid nutrition record: check date, calorie target and meals");
  const normalized = normalizeLoadedState(migrateAcceptedEvidence(accepted));
  return validateSyncedState({ ...normalized, activeWorkoutId: selectedActiveWorkout(normalized)?.id ?? null });
};
