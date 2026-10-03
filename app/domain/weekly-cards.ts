import { localDate, type TrainingState } from "./training-types";
import { dateInWindow } from "./training-insights";
import { workoutLiftingVolume } from "./training-metrics";
import { activityRows, activityTotals } from "./training-workflow";
import { activityBreakdownForLastDays } from "./training-coverage";
import { DEFAULT_WEEKLY_CARDS, WEEKLY_CARD_OPTIONS, type WeeklyCard } from "./display-preferences";

export function weeklyCards(state: TrainingState) {
  const breakdown = activityBreakdownForLastDays(state, state.settings.defaultUnit);
  return (state.settings.weeklyCards ?? DEFAULT_WEEKLY_CARDS).map(id => {
    const title = WEEKLY_CARD_OPTIONS.find(option => option.id === id)!.label;
    if (id === "strength") {
      const lifts = state.workouts.filter(workout => workout.status === "completed" && dateInWindow(workout.date, 7)).map(workout => ({ date: workout.date, ...workoutLiftingVolume(workout, state.settings.defaultUnit) }));
      const volume = lifts.reduce((sum, lift) => sum + lift.volume, 0);
      const sets = lifts.reduce((sum, lift) => sum + lift.countedSets, 0);
      return { id, title, value: `${Math.round(volume).toLocaleString()} ${state.settings.defaultUnit} × reps`, detail: `${sets} loaded sets · excludes BW`, dates: [...new Set(lifts.filter(lift => lift.countedSets > 0).map(lift => lift.date))] };
    }
    const start = new Date(); start.setDate(start.getDate() - 6);
    const rows = activityRows(state, id, localDate(start), localDate());
    const totals = activityTotals(rows);
    const special = id === "run" ? breakdown.runs : id === "ruck" ? breakdown.rucks : id === "water_polo" ? breakdown.waterPolo : id === "circuit" ? breakdown.circuits : null;
    const sessions = special?.sessions ?? rows.length;
    const minutes = special?.minutes ?? totals.minutes;
    const distance = special?.distanceKm ?? totals.distance;
    const dates = special?.dates ?? [...new Set(rows.map(row => row.workout.date))];
    const distanceTypes: WeeklyCard[] = ["run", "ruck", "swim", "bike", "row", "walk", "hike"];
    const value = distanceTypes.includes(id) ? `${Number(distance.toFixed(2))} km` : id === "circuit" || id === "force" ? `${sessions}` : `${Math.round(minutes)} min`;
    const load = id === "ruck" && breakdown.rucks.loadDistance ? ` · ${Math.round(breakdown.rucks.loadDistance)} ${state.settings.defaultUnit}·km` : "";
    const detail = `${sessions} session${sessions === 1 ? "" : "s"}${distanceTypes.includes(id) || id === "circuit" || id === "force" ? ` · ${Math.round(minutes)} min` : ""}${load}`;
    return { id, title, value, detail, dates };
  });
}
