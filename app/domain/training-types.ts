import type { HyroxSession } from "./hyrox";
export type Unit = "lb" | "kg";
export type LoadType = "weighted" | "bodyweight" | "unrecorded";
export type WeightMode = "total" | "per_hand" | "added";
export type WorkoutBlockType = "exercise" | "activity";

export interface MobilityMove {
  id: string;
  name: string;
  prescription: string;
}

export type WorkoutStatus = "planned" | "active" | "completed" | "skipped";

export interface CoachCheckIn {
  /** The local date this readiness snapshot belongs to; stale values must not carry into a new day. */
  date: string;
  energy: string;
  sleep: string;
  soreness: string;
  restrictions: string;
  schedule: string;
}

export const currentCoachCheckIn = (checkIn: CoachCheckIn, today = localDate()): CoachCheckIn =>
  checkIn.date === today
    ? checkIn
    : { ...checkIn, energy: "", sleep: "", soreness: "", restrictions: "", schedule: "" };

export interface TrainingSet {
  skipped?: boolean;
  id: string;
  plannedReps: string;
  plannedWeight: number | null;
  plannedRpe: string;
  plannedRir: string;
  actualReps: string;
  actualWeight: number | null;
  loadType: LoadType;
  weightMode: WeightMode;
  unit: Unit;
  rpe: string;
  rir: string;
  completed: boolean;
  completedAsPlanned: boolean;
  warmup: boolean;
  notes: string;
  updatedAt: string;
}

export interface ExerciseBlock {
  substitutedFor?: string;
  id: string;
  name: string;
  restSec: number;
  notes: string;
  coachNotes: string;
  sets: TrainingSet[];
  deletedSetIds?: string[];
  updatedAt: string;
}

export interface ActivityEffort {
  id: string;
  plannedDistanceM: number | null;
  actualDistanceM: number | null;
  plannedDurationSec: number | null;
  actualDurationSec: number | null;
  plannedLoad: number | null;
  actualLoad: number | null;
  completed: boolean;
}

export interface CardioEntry {
  id: string;
  /** The selected external activity already attached to this entry. */
  externalSourceId?: string;
  name: string;
  activityType:
    | "run"
    | "swim"
    | "water_polo"
    | "bike"
    | "row"
    | "walk"
    | "hike"
    | "ruck"
    | "mobility"
    | "circuit"
    | "force"
    | "soccer"
    | "grappling"
    | "yoga"
    | "other";
  loggingStyle?: "single" | "routine" | "efforts";
  efforts?: ActivityEffort[];
  effortRestSec?: number;
  effortLoadUnit?: Unit;
  plannedDurationMin: number | null;
  actualDurationMin: number | null;
  plannedDistanceKm: number | null;
  actualDistanceKm: number | null;
  ruckLoad: number | null;
  ruckLoadUnit: Unit;
  averageHr: number | null;
  elevationM: number | null;
  pace: string;
  intensity: string;
  intervals: string;
  mobilityMoves: MobilityMove[];
  effort: string;
  notes: string;
  coachNotes: string;
  completed: boolean;
  completedAsPlanned: boolean;
  updatedAt: string;
}

export interface WorkoutSession {
  hyrox?: HyroxSession;
  id: string;
  name: string;
  date: string;
  /** The timezone in which the training date was intentionally recorded. */
  timezone: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  skipReason: string;
  status: WorkoutStatus;
  exercises: ExerciseBlock[];
  cardio: CardioEntry[];
  deletedExerciseIds?: string[];
  deletedActivityIds?: string[];
  blockOrder: Array<{ type: WorkoutBlockType; id: string }>;
  notes: string;
  sessionRpe: string;
  source: "manual" | "fitlog" | "repeat" | "history";
  importWarnings?: string[];
  /** Used only to warn before importing the same FITLOG block twice. */
  importFingerprint?: string;
  originKey?: string;
  updatedAt?: string;
}

export interface BodyweightEntry {
  id: string;
  /** An explicit local calendar date; it is never derived from a UTC timestamp. */
  date: string;
  weight: number;
  unit: Unit;
  updatedAt: string;
}

export type CoverageMuscle =
  | "Chest" | "Lats" | "Upper back" | "Front delts" | "Side delts" | "Rear delts"
  | "Biceps" | "Triceps" | "Abs" | "Quads" | "Hamstrings" | "Glutes" | "Calves";

export interface ExerciseMuscleTarget {
  primary: CoverageMuscle[];
  secondary?: CoverageMuscle[];
  updatedAt?: string;
  deletedAt?: string;
}

export const QUICK_LOG_OPTIONS = [
  { type: "run", label: "Run" }, { type: "swim", label: "Swim" },
  { type: "bike", label: "Bike" }, { type: "ruck", label: "Ruck" },
  { type: "circuit", label: "Circuit" }, { type: "soccer", label: "Soccer" },
  { type: "grappling", label: "Grappling" }, { type: "yoga", label: "Yoga" },
  { type: "water_polo", label: "Water polo" },
] as const;
export type QuickLogActivityType = (typeof QUICK_LOG_OPTIONS)[number]["type"];
export const DEFAULT_QUICK_LOG_ACTIVITIES: QuickLogActivityType[] = QUICK_LOG_OPTIONS.map(option => option.type);

export interface AppSettings {
  bodyDiagram?: "male" | "female";
  quickLogActivities?: QuickLogActivityType[];
  defaultUnit: Unit;
  defaultRestSec: number;
  barWeightLb: number;
  barWeightKg: number;
  lastBackupAt: string | null;
  installedHintDismissed: boolean;
  coachCheckIn: CoachCheckIn;
  lastCoachBriefAt: string | null;
}

export interface FieldConflict {
  id: string;
  recordId: string;
  fieldPath: string;
  base: unknown;
  remoteValue: unknown;
  raisingDeviceId: string;
  raisingDeviceValue: unknown;
  createdAt: string;
}

export interface WaistEntry { id: string; date: string; cm: number; updatedAt: string; deletedAt?: string; }
export interface LoadIncrement { value: number; updatedAt: string; }
export interface PinnedBenchmark {
  id: string;
  name: string;
  protocol: string;
  result: string;
  testedOn: string | null;
  attempts?: { id: string; date: string; result: string; protocol: string; updatedAt: string }[];
  retestDays: number | null;
  updatedAt: string;
  deletedAt?: string;
}

export interface TrainingState {
  evidenceVersion?: 2;
  pendingConflicts?: FieldConflict[];
  resolvedConflictIds?: string[];
  waistEntries?: WaistEntry[];
  loadIncrements?: Record<string, LoadIncrement>;
  version: 1;
  workouts: WorkoutSession[];
  bodyweightEntries: BodyweightEntry[];
  benchmarks?: PinnedBenchmark[];
  deletedWorkoutIds: string[];
  activeWorkoutId: string | null;
  goals: string[];
  /** Section-level timestamps keep simple preference edits deterministic across devices. */
  goalsUpdatedAt: string;
  coachProfile: string;
  coachProfileUpdatedAt: string;
  exerciseAliases: Record<string, string>;
  exerciseMuscleOverrides: Record<string, ExerciseMuscleTarget>;
  scheduleContext: {
    events: Array<{ id: string; date: string; label: string; updatedAt?: string; deletedAt?: string }>;
    phases: Array<{ id: string; start: string; end: string; label: string; updatedAt?: string; deletedAt?: string }>;
  };
  settings: AppSettings;
  settingsUpdatedAt: string;
}

export interface CoachOptions {
  mode: "new" | "continue";
  days: 0 | 1 | 7 | 14 | 30;
  since?: string | null;
  /** Precise sent time used to include corrections to sessions whose training date is older than the visible cutoff. */
  sinceAt?: string | null;
  energy: string;
  sleep: string;
  soreness: string;
  timeAvailable: string;
  equipment: string;
  restrictions: string;
  schedule: string;
  request: string;
}

export const uid = (prefix = "id") => {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
};

export const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export const makeSet = (
  unit: Unit,
  overrides: Partial<TrainingSet> = {},
): TrainingSet => ({
  id: uid("set"),
  plannedReps: "8",
  plannedWeight: null,
  plannedRpe: "",
  plannedRir: "",
  actualReps: "",
  actualWeight: null,
  loadType: "unrecorded",
  weightMode: "total",
  unit,
  rpe: "",
  rir: "",
  completed: false,
  completedAsPlanned: false,
  warmup: false,
  notes: "",
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const makeExercise = (
  unit: Unit,
  restSec = 120,
  name = "New exercise",
): ExerciseBlock => ({
  id: uid("exercise"),
  name,
  restSec,
  notes: "",
  coachNotes: "",
  sets: [makeSet(unit), makeSet(unit), makeSet(unit)],
  updatedAt: new Date().toISOString(),
});

export const makeCardio = (
  activityType: CardioEntry["activityType"] = "run",
  name?: string,
): CardioEntry => ({
  id: uid("cardio"),
  name:
    name ??
    ({
      run: "Running",
      swim: "Swimming",
      water_polo: "Water polo",
      bike: "Cycling",
      row: "Rowing",
      walk: "Walking",
      hike: "Hiking",
      ruck: "Ruck march",
      mobility: "Mobility",
      circuit: "Circuit",
      force: "FORCE circuit",
      soccer: "Soccer",
      grappling: "Grappling",
      yoga: "Yoga",
      other: "Custom activity",
    } satisfies Record<CardioEntry["activityType"], string>)[activityType],
  activityType,
  loggingStyle: ["mobility", "circuit", "force", "soccer", "grappling", "yoga", "water_polo"].includes(activityType) ? "routine" : activityType === "other" ? undefined : "single",
  efforts: [],
  effortRestSec: 0,
  effortLoadUnit: "lb",
  plannedDurationMin: null,
  actualDurationMin: null,
  plannedDistanceKm: null,
  actualDistanceKm: null,
  ruckLoad: null,
  ruckLoadUnit: "lb",
  averageHr: null,
  elevationM: null,
  pace: "",
  intensity: "",
  intervals: "",
  mobilityMoves: [],
  effort: "",
  notes: "",
  coachNotes: "",
  completed: false,
  completedAsPlanned: false,
  updatedAt: new Date().toISOString(),
});

export const makeWorkout = (
  unit: Unit,
  restSec: number,
  name = "Training session",
): WorkoutSession => {
  const now = new Date().toISOString();
  const exercise = makeExercise(unit, restSec);
  return {
    id: uid("workout"),
    name,
    date: localDate(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    createdAt: now,
    startedAt: now,
    completedAt: null,
    skippedAt: null,
    skipReason: "",
    status: "active",
    exercises: [exercise],
    cardio: [],
    blockOrder: [{ type: "exercise", id: exercise.id }],
    notes: "",
    sessionRpe: "",
    source: "manual",
    updatedAt: now,
  };
};

export const defaultState = (): TrainingState => ({
  version: 1,
  evidenceVersion: 2,
  pendingConflicts: [],
  resolvedConflictIds: [],
  workouts: [],
  bodyweightEntries: [],
  benchmarks: [],
  deletedWorkoutIds: [],
  activeWorkoutId: null,
  goals: [],
  goalsUpdatedAt: "1970-01-01T00:00:00.000Z",
  coachProfile: "",
  coachProfileUpdatedAt: "1970-01-01T00:00:00.000Z",
  exerciseAliases: {
    bench: "Barbell Bench Press",
    "bench press": "Barbell Bench Press",
    "bb bench": "Barbell Bench Press",
    deads: "Barbell Deadlift",
    deadlift: "Barbell Deadlift",
    pullups: "Pull-Up",
    "pull ups": "Pull-Up",
  },
  exerciseMuscleOverrides: {},
  scheduleContext: { events: [], phases: [] },
  settings: {
    bodyDiagram: "male",
    quickLogActivities: [...DEFAULT_QUICK_LOG_ACTIVITIES],
    defaultUnit: "lb",
    defaultRestSec: 120,
    barWeightLb: 45,
    barWeightKg: 20,
    lastBackupAt: null,
    installedHintDismissed: false,
    coachCheckIn: { date: "", energy: "", sleep: "", soreness: "", restrictions: "", schedule: "" },
    lastCoachBriefAt: null,
  },
  settingsUpdatedAt: "1970-01-01T00:00:00.000Z",
});
