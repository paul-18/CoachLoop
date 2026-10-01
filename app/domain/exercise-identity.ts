const exerciseKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Resolve aliases by their normalized form, including a short alias chain, before grouping records or charts. */
export const canonicalExerciseName = (name: string, aliases: Record<string, string> = {}) => {
  const lookup = new Map(Object.entries(aliases).map(([alias, target]) => [exerciseKey(alias), target.trim()]));
  let canonical = name.trim();
  const seen = new Set<string>();
  while (canonical && !seen.has(exerciseKey(canonical))) {
    seen.add(exerciseKey(canonical));
    const next = lookup.get(exerciseKey(canonical));
    if (!next || exerciseKey(next) === exerciseKey(canonical)) break;
    canonical = next;
  }
  return canonical;
};
export const exerciseIdentity = (name: string, aliases: Record<string, string> = {}) =>
  exerciseKey(canonicalExerciseName(name, aliases));

