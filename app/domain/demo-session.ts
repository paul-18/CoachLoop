import { defaultState, localDate, makeCardio, makeExercise, makeSet, makeWorkout, uid, type CardioEntry, type TrainingSet, type TrainingState, type Unit, type WorkoutSession } from "./training-types";

function dateBefore(today: string, days: number) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function workingSet(unit: Unit, reps: string, weight: number | null, loadType: TrainingSet["loadType"] = "weighted"): TrainingSet {
  return makeSet(unit, {
    plannedReps: reps,
    plannedWeight: weight,
    actualReps: reps,
    actualWeight: weight,
    loadType,
    weightMode: "total",
    completed: true,
    completedAsPlanned: false,
  });
}

function strengthSession(unit: Unit, name: string, date: string, now: string, exercises: Array<{ name: string; sets: TrainingSet[] }>): WorkoutSession {
  const blocks = exercises.map((item) => {
    const exercise = makeExercise(unit, 120, item.name);
    exercise.sets = item.sets;
    return exercise;
  });
  const workout = makeWorkout(unit, 120, name);
  workout.date = date;
  workout.status = "completed";
  workout.startedAt = now;
  workout.completedAt = now;
  workout.updatedAt = now;
  workout.exercises = blocks;
  workout.cardio = [];
  workout.blockOrder = blocks.map((exercise) => ({ type: "exercise", id: exercise.id }));
  return workout;
}

function activitySession(name: string, date: string, now: string, activity: CardioEntry): WorkoutSession {
  const workout = makeWorkout("lb", 0, name);
  workout.date = date;
  workout.status = "completed";
  workout.startedAt = now;
  workout.completedAt = now;
  workout.updatedAt = now;
  workout.exercises = [];
  workout.cardio = [activity];
  workout.blockOrder = [{ type: "activity", id: activity.id }];
  return workout;
}

function pace(distanceKm: number, durationMin: number) {
  const seconds = Math.round((durationMin * 60) / distanceKm);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

function run(name: string, distanceKm: number, durationMin: number, effort: string, intervals = ""): CardioEntry {
  const activity = makeCardio("run", name);
  activity.completed = true;
  activity.actualDistanceKm = distanceKm;
  activity.plannedDistanceKm = distanceKm;
  activity.actualDurationMin = durationMin;
  activity.plannedDurationMin = durationMin;
  activity.pace = pace(distanceKm, durationMin);
  activity.effort = effort;
  activity.intervals = intervals;
  return activity;
}

/** Sample log for looking around. Dates are relative to the day demo is opened. It must not be written. */
export function buildDemoState(today = localDate()): TrainingState {
  const now = new Date().toISOString();
  const state = defaultState();
  const easyDistance = Math.round((6.1 + (Math.random() - 0.5) * 0.6) * 10) / 10;
  const easyMinutes = Math.round(easyDistance * 6.3);
  state.goals = ["Bench press 205 lb", "Run a 5k under 27 minutes"];
  state.goalsUpdatedAt = now;
  state.coachProfile = "Demo profile for a lifter who also runs and rucks. This is not your profile.";
  state.coachProfileUpdatedAt = now;
  state.settings = { ...state.settings, welcomeChoice: "starter", quickLogActivities: ["run", "bike", "circuit", "yoga"], coachingPromptDismissed: true };
  state.settingsUpdatedAt = now;

  const push = (date: string, bench: number, press: number) => strengthSession("lb", "Upper push", date, now, [
    { name: "Barbell Bench Press", sets: [workingSet("lb", "8", bench - 20), workingSet("lb", "6", bench), workingSet("lb", "5", bench + 10), workingSet("lb", "5", bench + 10)] },
    { name: "Overhead Press", sets: [workingSet("lb", "8", press), workingSet("lb", "6", press + 5), workingSet("lb", "6", press + 5)] },
    { name: "Lateral Raise", sets: [workingSet("lb", "12", 15), workingSet("lb", "12", 15), workingSet("lb", "10", 20)] },
    { name: "Triceps Pushdown", sets: [workingSet("lb", "12", 40), workingSet("lb", "10", 50), workingSet("lb", "10", 50)] },
  ]);
  const pull = strengthSession("lb", "Upper pull", dateBefore(today, 2), now, [
    { name: "Pull-Up", sets: [workingSet("lb", "6", null, "bodyweight"), workingSet("lb", "5", null, "bodyweight"), workingSet("lb", "5", null, "bodyweight"), workingSet("lb", "4", null, "bodyweight")] },
    { name: "Barbell Row", sets: [workingSet("lb", "8", 115), workingSet("lb", "8", 135), workingSet("lb", "6", 145)] },
    { name: "Rear Delt Fly", sets: [workingSet("lb", "15", 15), workingSet("lb", "12", 20), workingSet("lb", "12", 20)] },
    { name: "Barbell Curl", sets: [workingSet("lb", "10", 55), workingSet("lb", "8", 65), workingSet("lb", "8", 65)] },
  ]);
  const lower = (date: string, squat: number) => strengthSession("lb", "Lower body", date, now, [
    { name: "Back Squat", sets: [workingSet("lb", "6", squat), workingSet("lb", "5", squat + 10), workingSet("lb", "5", squat + 10)] },
    { name: "Romanian Deadlift", sets: [workingSet("lb", "8", squat - 40), workingSet("lb", "8", squat - 30), workingSet("lb", "6", squat - 20)] },
    { name: "Standing Calves", sets: [workingSet("lb", "12", 80), workingSet("lb", "10", 100)] },
    { name: "Plank", sets: [workingSet("lb", "1", null, "bodyweight"), workingSet("lb", "1", null, "bodyweight")] },
  ]);

  const olderPush = push(dateBefore(today, 12), 135, 65);
  olderPush.exercises[0].name = "Incline Bench Press";
  const recentPush = push(dateBefore(today, 6), 155, 75);
  const ruck = makeCardio("ruck", "Loaded walk");
  ruck.completed = true;
  ruck.actualDistanceKm = 4.6;
  ruck.plannedDistanceKm = 4.5;
  ruck.actualDurationMin = 58;
  ruck.plannedDurationMin = 55;
  ruck.ruckLoad = 25;
  ruck.ruckLoadUnit = "lb";
  ruck.pace = pace(4.6, 58);
  ruck.effort = "Steady";
  const mobility = makeCardio("mobility", "Recovery mobility");
  mobility.completed = true;
  mobility.actualDurationMin = 18;
  mobility.plannedDurationMin = 20;
  mobility.notes = "Hips, t-spine, and easy breathing. No lifting.";

  state.workouts = [
    activitySession("Tempo run", dateBefore(today, 1), now, run("Tempo run", 5, 26, "Moderate", "2 km easy, 2 km steady, 1 km easy")),
    pull,
    lower(dateBefore(today, 4), 185),
    activitySession("Easy run", dateBefore(today, 5), now, run("Easy run", easyDistance, easyMinutes, "Easy")),
    recentPush,
    activitySession("Recovery", dateBefore(today, 8), now, mobility),
    activitySession("Ruck", dateBefore(today, 9), now, ruck),
    lower(dateBefore(today, 10), 175),
    activitySession("Long run", dateBefore(today, 13), now, run("Long run", 10.4, 67, "Easy")),
    olderPush,
  ];
  state.bodyweightEntries = [
    { id: uid("bodyweight"), date: dateBefore(today, 2), weight: 181, unit: "lb", updatedAt: now },
    { id: uid("bodyweight"), date: dateBefore(today, 9), weight: 182, unit: "lb", updatedAt: now },
  ];
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
