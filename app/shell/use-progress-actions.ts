import { toast } from "sonner";
import { validMeasurementDate } from "../domain/training-workflow";
import { localDate, uid, type Unit, type TrainingState, type CardioEntry, type WaistEntry } from "../domain/training-types";
import { emptyDayLog, type MealEntry, type NutritionDayLog } from "../domain/nutrition-types";
import { formatDate } from "../views/shared";
import type { useTrainingPersistence } from "../persistence/use-training-persistence";

export function useProgressActions({ setState }: Pick<ReturnType<typeof useTrainingPersistence>, "setState">) {
  const logBodyweight = (weight: number, unit: Unit, date: string) => {
    if (!validMeasurementDate(date) || date > localDate()) return toast.error("Use a valid date that is not in the future");
    const updatedAt = new Date().toISOString();
    setState((current) => {
      const existing = current.bodyweightEntries.find((entry) => entry.date === date);
      const entry = { id: existing?.id ?? uid("bodyweight"), date, weight, unit, updatedAt };
      return {
        ...current,
        bodyweightEntries: existing
          ? current.bodyweightEntries.map((item) => item.id === existing.id ? entry : item)
          : [...current.bodyweightEntries, entry],
      };
    });
    toast.success(`Bodyweight logged for ${formatDate(date)}`);
  };

  const updateSettings = (update: (settings: TrainingState["settings"]) => TrainingState["settings"]) =>
    setState(current => ({ ...current, settings: update(current.settings), settingsUpdatedAt: new Date().toISOString() }));
  const changeActivityType = (workoutId: string, activityId: string, type: CardioEntry["activityType"]) =>
    setState(current => ({ ...current, workouts: current.workouts.map(workout => workout.id === workoutId && workout.status === "completed"
      ? { ...workout, updatedAt: new Date().toISOString(), cardio: workout.cardio.map(activity => activity.id === activityId ? { ...activity, activityType: type, updatedAt: new Date().toISOString() } : activity) }
      : workout) }));
  const saveWaist = (entry: WaistEntry) =>
    setState(current => ({ ...current, waistEntries: [...(current.waistEntries ?? []).filter(e => e.date !== entry.date), entry] }));
  const updateLoadIncrement = (key: string, value: number) =>
    setState(current => ({ ...current, loadIncrements: { ...current.loadIncrements, [key]: { value, updatedAt: new Date().toISOString() } } }));
  const upsertNutritionDay = (date: string, update: (log: NutritionDayLog) => NutritionDayLog) =>
    setState(current => {
      const existing = current.nutritionLogs.find(log => log.date === date);
      const next = update(existing ?? emptyDayLog(date, current.settings.dailyKcalTarget ?? 0));
      return {
        ...current,
        nutritionLogs: existing
          ? current.nutritionLogs.map(log => log.date === date ? next : log)
          : [...current.nutritionLogs, next],
      };
    });
  const logMeal = (date: string, meal: MealEntry) => {
    upsertNutritionDay(date, log => ({ ...log, meals: [...log.meals, meal] }));
    toast.success(`${meal.name} logged · ${meal.kcal.toLocaleString()} kcal`);
  };
  const deleteMeal = (date: string, mealId: string) =>
    upsertNutritionDay(date, log => ({ ...log, meals: log.meals.filter(meal => meal.id !== mealId) }));
  return { logBodyweight, updateSettings, changeActivityType, saveWaist, updateLoadIncrement, logMeal, deleteMeal };
}
