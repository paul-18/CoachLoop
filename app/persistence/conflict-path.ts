/** Paths never traverse prototypes or target structural collections. */
export function safeConflictPath(path: string): boolean {
  try {
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (!path.startsWith("/") || !parts.length || parts.some((p) => ["__proto__", "constructor", "prototype"].includes(p))) return false;
    const last = parts.at(-1)!;
    if (["id", "workouts", "exercises", "sets", "cardio", "events", "phases", "benchmarks", "pendingConflicts", "resolvedConflictIds", "activeWorkoutId", "version"].includes(last)) return false;
    return ["goals", "coachProfile", "settings", "exerciseAliases", "loadIncrements", "exerciseMuscleOverrides", "workouts", "bodyweightEntries", "waistEntries", "scheduleContext", "benchmarks"].includes(parts[0]);
  } catch { return false; }
}
