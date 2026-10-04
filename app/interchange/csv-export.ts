import type { TrainingSet } from "../domain/training-types";

export const csvSetEffort = (set: Pick<TrainingSet, "rpe" | "rir">) =>
  [set.rpe.trim() ? `RPE ${set.rpe.trim()}` : "", set.rir.trim() ? `RIR ${set.rir.trim()}` : ""].filter(Boolean).join("; ");

/**
 * Spreadsheet applications may evaluate cells beginning with these characters
 * as formulas. Prefixing an apostrophe keeps exported training text literal.
 */
export const neutralizeCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  let meaningful = text.trimStart();
  while (meaningful && (meaningful.charCodeAt(0) < 32 || meaningful.charCodeAt(0) === 127)) meaningful = meaningful.slice(1).trimStart();
  return /^[=+\-@]/.test(meaningful) ? `'${text}` : text;
};

export const csvCell = (value: unknown) => `"${neutralizeCsvCell(value).replaceAll('"', '""')}"`;

export const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\n");
