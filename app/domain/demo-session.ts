import { defaultState, localDate, makeCardio, makeSet, makeWorkout, uid, type TrainingState } from "./training-types";

function shiftDate(today: string, days: number) {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

/** Sample log for looking around. It is not a saved profile and must not be written. */
export function buildDemoState(today = localDate()): TrainingState {
  const now = new Date().toISOString();
  const state = defaultState();
  state.goals = ["Bench press 225 lb", "Run a 5k under 30 minutes"];
  state.goalsUpdatedAt = now;
  state.coachProfile = "Demo coach notes. This is sample text, not your profile.";
  state.coachProfileUpdatedAt = now;
  state.settings = { ...state.settings, welcomeChoice: "starter", quickLogActivities: ["run", "bike", "circuit", "yoga"] };
  state.settingsUpdatedAt = now;

  const bench = makeWorkout("lb", 120, "Bench practice");
  bench.date = shiftDate(today, -2);
  bench.status = "completed";
  bench.completedAt = now;
  bench.exercises[0].name = "Barbell Bench Press";
  bench.exercises[0].sets = [makeSet("lb", { completed: true, actualReps: "5", actualWeight: 135, plannedReps: "5", plannedWeight: 135, loadType: "weighted", weightMode: "total" })];

  const run = makeWorkout("lb", 0, "Easy run");
  run.date = shiftDate(today, -1);
  run.status = "completed";
  run.completedAt = now;
  const activity = makeCardio("run", "Easy run");
  activity.completed = true;
  activity.actualDurationMin = 20;
  activity.actualDistanceKm = 3;
  run.exercises = [];
  run.cardio = [activity];
  run.blockOrder = [{ type: "activity", id: activity.id }];

  state.workouts = [run, bench];
  state.bodyweightEntries = [{ id: uid("bodyweight"), date: shiftDate(today, -1), weight: 180, unit: "lb", updatedAt: now }];
  return state;
}

/** Demo edits stay on the sample. The real log is returned unchanged. */
export function projectDemoUpdate(real: TrainingState, demo: TrainingState | null, update: TrainingState | ((current: TrainingState) => TrainingState)) {
  if (!demo) {
    const next = typeof update === "function" ? update(real) : update;
    return { real: next, demo: null as TrainingState | null };
  }
  const next = typeof update === "function" ? update(demo) : update;
  return { real, demo: next };
}
