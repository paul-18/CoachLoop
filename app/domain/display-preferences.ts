export const COLOR_THEMES = [
  { id: "lime", label: "Lime", color: "#c6ff4a", rgb: "198,255,74" },
  { id: "peach", label: "Peach", color: "#f0a37d", rgb: "240,163,125" },
  { id: "sky", label: "Sky Blue", color: "#66c7ff", rgb: "102,199,255" },
  { id: "violet", label: "Soft Violet", color: "#d59cff", rgb: "213,156,255" },
] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number]["id"];
export const WEEKLY_CARD_OPTIONS = [
  { id: "strength", label: "Strength" }, { id: "run", label: "Runs" },
  { id: "ruck", label: "Rucks" }, { id: "water_polo", label: "Water polo" },
  { id: "circuit", label: "Circuits" }, { id: "swim", label: "Swimming" },
  { id: "bike", label: "Cycling" }, { id: "row", label: "Rowing" },
  { id: "walk", label: "Walking" }, { id: "hike", label: "Hiking" },
  { id: "soccer", label: "Soccer" }, { id: "grappling", label: "Grappling" },
  { id: "yoga", label: "Yoga" }, { id: "mobility", label: "Mobility" },
  { id: "force", label: "FORCE" }, { id: "other", label: "Other activities" },
] as const;
export type WeeklyCard = (typeof WEEKLY_CARD_OPTIONS)[number]["id"];
export const DEFAULT_WEEKLY_CARDS: WeeklyCard[] = ["strength", "run", "ruck", "water_polo", "circuit"];
export const PROGRESS_SECTION_OPTIONS = [
  { id: "weekly", label: "Last 7 days" }, { id: "coverage", label: "Strength coverage" },
  { id: "balance", label: "Lift balance" }, { id: "bodyweight", label: "Bodyweight" },
  { id: "trends", label: "Exercise trends" }, { id: "benchmarks", label: "Pinned benchmarks" },
  { id: "activities", label: "Activity histories" }, { id: "waist", label: "Waist tracking" },
  { id: "monthly", label: "Monthly review" }, { id: "calendar", label: "Training calendar" },
  { id: "records", label: "Exercise records" },
] as const;
export type ProgressSection = (typeof PROGRESS_SECTION_OPTIONS)[number]["id"];
export const DEFAULT_PROGRESS_SECTIONS: ProgressSection[] = PROGRESS_SECTION_OPTIONS.map(option => option.id);
export function toggleChoice<T extends string>(current: readonly T[], value: T, selected: boolean): T[] {
  return selected ? [...new Set([...current, value])] : current.filter(item => item !== value);
}
