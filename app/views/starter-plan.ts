import { exampleFitlog, parseFitlog } from "../interchange/fitlog";
import { DEFAULT_COACH_PROFILE } from "../interchange/coach-export";
import { STARTER_QUICK_LOG_ACTIVITIES, type TrainingState } from "../domain/training-types";
import { STARTER_GOALS } from "./goal-examples";

export function starterPlanState(state: TrainingState): TrainingState {
  if (state.settings.welcomeChoice) return state;
  const now = new Date().toISOString();
  let workouts = state.workouts;
  if (!workouts.length) {
    try {
      const parsed = parseFitlog(exampleFitlog(), state.settings.defaultUnit, state.exerciseAliases);
      workouts = [{ ...parsed, status: "planned", startedAt: null, completedAt: null, skippedAt: null, skipReason: "", updatedAt: now }];
    } catch { /* Goals and profile still save if the example cannot be read. */ }
  }
  return {
    ...state,
    goals: [...STARTER_GOALS],
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
