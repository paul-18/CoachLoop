import { exampleFitlog, parseFitlog } from "../interchange/fitlog";
import { DEFAULT_COACH_PROFILE } from "../interchange/coach-export";
import { STARTER_QUICK_LOG_ACTIVITIES, type TrainingState, type WorkoutSession } from "../domain/training-types";
import { goalsAreStarter, starterGoals } from "./goal-examples";

function seedIsClean(workout: WorkoutSession) {
  if (!workout.starterSeed || workout.status !== "planned") return false;
  const loggedSet = workout.exercises.some(exercise => exercise.sets.some(set => set.completed || set.skipped || set.actualReps.trim() || set.actualWeight != null || set.rpe.trim() || set.rir.trim()));
  const loggedActivity = workout.cardio.some(activity => activity.completed || activity.actualDurationMin != null || activity.actualDistanceKm != null || activity.efforts?.some(effort => effort.completed));
  return !loggedSet && !loggedActivity;
}

export function starterPlanState(state: TrainingState): TrainingState {
  if (state.settings.welcomeChoice) return state;
  const now = new Date().toISOString();
  let workouts = state.workouts;
  if (!workouts.length) {
    try {
      const parsed = parseFitlog(exampleFitlog(state.settings.defaultUnit), state.settings.defaultUnit, state.exerciseAliases);
      workouts = [{ ...parsed, name: "Starter session", starterSeed: true, status: "planned", startedAt: null, completedAt: null, skippedAt: null, skipReason: "", updatedAt: now }];
    } catch { /* Goals and profile still save if the example cannot be read. */ }
  }
  return {
    ...state,
    goals: starterGoals(state.settings.defaultUnit),
    goalsUpdatedAt: now,
    coachProfile: DEFAULT_COACH_PROFILE,
    coachProfileUpdatedAt: now,
    workouts,
    settings: { ...state.settings, welcomeChoice: "starter", quickLogActivities: [...STARTER_QUICK_LOG_ACTIVITIES] },
    settingsUpdatedAt: now,
  };
}

export function blankStartState(state: TrainingState): TrainingState {
  if (state.settings.welcomeChoice) return state;
  const now = new Date().toISOString();
  return { ...state, settings: { ...state.settings, welcomeChoice: "blank", quickLogActivities: [...STARTER_QUICK_LOG_ACTIVITIES] }, settingsUpdatedAt: now };
}

export function starterRemovable(state: TrainingState) {
  if (state.settings.welcomeChoice !== "starter") return false;
  const seeds = state.workouts.filter(workout => workout.starterSeed);
  return seeds.every(seedIsClean);
}
export function removeStarterState(state: TrainingState): TrainingState {
  if (state.settings.welcomeChoice !== "starter") return state;
  const seeds = state.workouts.filter(workout => workout.starterSeed);
  if (seeds.some(workout => !seedIsClean(workout))) return state;
  const now = new Date().toISOString();
  const goalsMatch = goalsAreStarter(state.goals, state.settings.defaultUnit);
  const profileMatch = state.coachProfile === DEFAULT_COACH_PROFILE;
  const settings = { ...state.settings };
  delete settings.welcomeChoice;
  return {
    ...state,
    workouts: state.workouts.filter(workout => !workout.starterSeed),
    deletedWorkoutIds: [...new Set([...state.deletedWorkoutIds, ...seeds.map(workout => workout.id)])],
    goals: goalsMatch ? [] : state.goals,
    goalsUpdatedAt: goalsMatch ? now : state.goalsUpdatedAt,
    coachProfile: profileMatch ? "" : state.coachProfile,
    coachProfileUpdatedAt: profileMatch ? now : state.coachProfileUpdatedAt,
    settings,
    settingsUpdatedAt: now,
  };
}
