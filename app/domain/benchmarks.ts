import { localDate, type PinnedBenchmark } from "./training-types";

export function benchmarkAttempts(item: PinnedBenchmark) {
  const attempts = [...(item.attempts ?? [])];
  if (item.result && item.testedOn && !attempts.some((entry) => entry.result === item.result && entry.date === item.testedOn)) {
    attempts.push({ id: `legacy-${item.id}-${item.testedOn}`, date: item.testedOn, result: item.result, protocol: item.protocol, updatedAt: item.updatedAt });
  }
  return attempts.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export function benchmarkDueDate(item: PinnedBenchmark): string | null {
  if (!item.testedOn || !item.retestDays || item.deletedAt) return null;
  const date = new Date(`${item.testedOn}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + item.retestDays);
  return date.toISOString().slice(0, 10);
}

export function pendingRetests(items: PinnedBenchmark[], today = localDate()) {
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 14);
  const until = horizon.toISOString().slice(0, 10);
  return items.flatMap((item) => {
    const due = benchmarkDueDate(item);
    return due && due <= until ? [{ item, due }] : [];
  }).sort((a, b) => a.due.localeCompare(b.due));
}
