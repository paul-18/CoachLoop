import { exampleFitlog, parseFitlog } from "../interchange/fitlog";
import { DEFAULT_COACH_PROFILE } from "../interchange/coach-export";
import { STARTER_QUICK_LOG_ACTIVITIES, DEFAULT_QUICK_LOG_ACTIVITIES, type TrainingState, type WorkoutSession } from "../domain/training-types";
import { goalsAreStarter, starterGoals } from "./goal-examples";

function seedIsClean(workout: WorkoutSession) {
  if (!workout.starterSeed || workout.status !== "planned") return false;
  const loggedSet = workout.exercises.some(exercise => exercise.sets.some(set => set.completed || set.skipped || set.actualReps.trim() || set.actualWeight != null || set.rpe.trim() || set.rir.trim()));
  const loggedActivity = workout.cardio.some(activity => activity.completed || activity.actualDurationMin != null || activity.actualDistanceKm != null || activity.efforts?.some(effort => effort.completed));
  return !loggedSet && !loggedActivity;
}

export function exampleSetupState(state: TrainingState): TrainingState {
  if (state.settings.welcomeChoice) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    goals: starterGoals(state.settings.defaultUnit),
    goalsUpdatedAt: now,
    coachProfile: DEFAULT_COACH_PROFILE,
    coachProfileUpdatedAt: now,
    settings: { ...state.settings, welcomeChoice: "starter", quickLogActivities: [...STARTER_QUICK_LOG_ACTIVITIES] },
    settingsUpdatedAt: now,
  };
}

export function samplePlan(unit: TrainingState["settings"]["defaultUnit"], aliases: TrainingState["exerciseAliases"] = {}): WorkoutSession {
  const parsed = parseFitlog(exampleFitlog(unit), unit, aliases);
  return { ...parsed, name: "Sample workout", starterSeed: false, status: "planned", startedAt: null, completedAt: null, skippedAt: null, skipReason: "", updatedAt: new Date().toISOString() };
}

export function addSamplePlan(state: TrainingState): TrainingState {
  if (state.workouts.some(workout => workout.starterSeed)) return state;
  const now = new Date().toISOString();
  const plan = { ...samplePlan(state.settings.defaultUnit, state.exerciseAliases), starterSeed: true, updatedAt: now };
  const quickLog = state.settings.quickLogActivities;
  const untouchedDefault = !quickLog || quickLog.join() === DEFAULT_QUICK_LOG_ACTIVITIES.join();
  const useStarterShortcuts = !state.settings.welcomeChoice && untouchedDefault;
  return {
    ...state,
    workouts: [plan, ...state.workouts],
    settings: {
      ...state.settings,
      welcomeChoice: state.settings.welcomeChoice ?? "starter",
      ...(useStarterShortcuts ? { quickLogActivities: [...STARTER_QUICK_LOG_ACTIVITIES] } : {}),
    },
    settingsUpdatedAt: now,
  };
}

export function coachingPromptVisible(state: TrainingState) {
  return Boolean(state.settings.welcomeChoice) && !state.settings.coachingPromptDismissed && (!state.coachProfile.trim() || state.coachProfile === DEFAULT_COACH_PROFILE);
}

export function dismissCoachingPrompt(state: TrainingState): TrainingState {
  if (state.settings.coachingPromptDismissed) return state;
  return { ...state, settings: { ...state.settings, coachingPromptDismissed: true }, settingsUpdatedAt: new Date().toISOString() };
}

export function blankStartState(state: TrainingState): TrainingState {
  if (state.settings.welcomeChoice) return state;
  const now = new Date().toISOString();
  return { ...state, settings: { ...state.settings, welcomeChoice: "blank", quickLogActivities: [...STARTER_QUICK_LOG_ACTIVITIES] }, settingsUpdatedAt: now };
}

export function blankStartReversible(state: TrainingState) {
  return state.settings.welcomeChoice === "blank" && !state.workouts.length && !state.goals.some(goal => goal.trim()) && !state.coachProfile.trim();
}

export function undoBlankStart(state: TrainingState): TrainingState {
  if (!blankStartReversible(state)) return state;
  const settings = { ...state.settings };
  delete settings.welcomeChoice;
  if (settings.quickLogActivities?.join() === STARTER_QUICK_LOG_ACTIVITIES.join()) settings.quickLogActivities = [...DEFAULT_QUICK_LOG_ACTIVITIES];
  return { ...state, settings, settingsUpdatedAt: new Date().toISOString() };
}

export function starterRemovable(state: TrainingState) {
  if (state.settings.welcomeChoice !== "starter") return false;
  const seeds = state.workouts.filter(workout => workout.starterSeed);
  return seeds.every(seedIsClean);
}

/** Says only what this log will actually lose. A setup with no starter workout does not claim one is removed. */
export function starterRemovalDescription(state: TrainingState): string {
  const seeds = state.workouts.filter(workout => workout.starterSeed);
  const parts = [
    seeds.length === 0
      ? "There is no starter workout to remove."
      : seeds.length === 1
        ? "This removes the sample starter workout."
        : `This removes the ${seeds.length} sample starter workouts.`,
  ];
  if (goalsAreStarter(state.goals, state.settings.defaultUnit)) parts.push("Starter goals that are still the examples will be cleared.");
  else if (state.goals.some(goal => goal.trim())) parts.push("Your goals stay.");
  if (state.coachProfile === DEFAULT_COACH_PROFILE) parts.push("The starter coach profile will be cleared.");
  else if (state.coachProfile.trim()) parts.push("Your coach profile stays.");
  parts.push("Other workouts stay.");
  return parts.join(" ");
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
