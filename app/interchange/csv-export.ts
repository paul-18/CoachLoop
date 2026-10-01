/**
 * Spreadsheet applications may evaluate cells beginning with these characters
 * as formulas. Prefixing an apostrophe keeps exported training text literal.
 */
export const neutralizeCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
};

export const csvCell = (value: unknown) => `"${neutralizeCsvCell(value).replaceAll('"', '""')}"`;

export const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\n");
