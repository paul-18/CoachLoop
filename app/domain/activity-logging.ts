import { uid, type ActivityEffort, type CardioEntry } from "./training-types";

export const activityLoggingStyle = (activity: CardioEntry): "single" | "routine" | "efforts" => {
  // Old custom activities had no logging style. Infer a useful view without rewriting them.
  if ((activity.efforts?.length ?? 0) > 0) return "efforts";
  if (activity.loggingStyle === "efforts") return "efforts";
  if (activity.loggingStyle === "routine") return "routine";
  if (activity.loggingStyle === "single") return "single";
  if (["mobility", "circuit", "force", "soccer", "grappling", "yoga", "water_polo"].includes(activity.activityType)) return "routine";
  if (activity.activityType === "other" && /\b(drag|carry|sled|sprint|shuttle|push|pull)\b/i.test(activity.name)) return "efforts";
  return activity.loggingStyle ?? "single";
};

export const makeActivityEffort = (): ActivityEffort => ({
  id: uid("effort"), plannedDistanceM: null, actualDistanceM: null,
  plannedDurationSec: null, actualDurationSec: null,
  plannedLoad: null, actualLoad: null, completed: false,
});

export const completeActivityEffort = (effort: ActivityEffort): ActivityEffort => ({
  ...effort, completed: true,
  actualDistanceM: effort.actualDistanceM ?? effort.plannedDistanceM,
  actualDurationSec: effort.actualDurationSec ?? effort.plannedDurationSec,
  actualLoad: effort.actualLoad ?? effort.plannedLoad,
});

export const activityEffortSummary = (activity: CardioEntry) => {
  const efforts = (activity.efforts ?? []).filter((effort) => effort.completed);
  if (!efforts.length) return "";
  const distances = efforts.map((effort) => effort.actualDistanceM).filter((value): value is number => value !== null);
  return `${efforts.length} effort${efforts.length === 1 ? "" : "s"}${distances.length === efforts.length ? ` · ${Number(distances.reduce((sum, value) => sum + value, 0).toFixed(2))} m` : ""}`;
};
