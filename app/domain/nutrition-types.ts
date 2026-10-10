import { uid } from "./training-types";

export interface MealEntry {
  id: string;
  name: string;
  kcal: number;
  proteinG?: number;
}

export interface NutritionDayLog {
  /** Local date (YYYY-MM-DD) this log belongs to. */
  date: string;
  targetKcal: number;
  meals: MealEntry[];
}

export const emptyDayLog = (date: string, targetKcal: number): NutritionDayLog => ({
  date,
  targetKcal,
  meals: [],
});

export const dayTotals = (log: NutritionDayLog): { kcal: number; proteinG: number } => ({
  kcal: log.meals.reduce((sum, meal) => sum + meal.kcal, 0),
  proteinG: log.meals.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0),
});

export const remainingKcal = (log: NutritionDayLog): number => log.targetKcal - dayTotals(log).kcal;

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    if (value.trim() === "") return undefined;
    value = Number(value.trim());
  }
  return typeof value === "number" ? value : undefined;
};

export function validateMeal(name: string, kcal: unknown, proteinG?: unknown): { name: string; kcal: number; proteinG?: number } {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Give the meal a name.");
  const kcalValue = toFiniteNumber(kcal);
  if (kcalValue === undefined || !Number.isFinite(kcalValue) || kcalValue < 0 || kcalValue > 20000)
    throw new Error("Enter the meal's calories as a number between 0 and 20,000.");
  const proteinValue = toFiniteNumber(proteinG);
  if (proteinValue !== undefined && (!Number.isFinite(proteinValue) || proteinValue < 0))
    throw new Error("Enter protein as 0 or more grams.");
  return proteinValue === undefined
    ? { name: cleanName, kcal: kcalValue }
    : { name: cleanName, kcal: kcalValue, proteinG: proteinValue };
}

export const makeMeal = (name: string, kcal: unknown, proteinG?: unknown): MealEntry => ({
  id: uid("meal"),
  ...validateMeal(name, kcal, proteinG),
});
