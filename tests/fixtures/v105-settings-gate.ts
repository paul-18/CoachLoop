// Faithful extract of the v105 backup gate that rejected "walk" quick-log
// lists, kept self-contained so a clean checkout can run this test.
//
// Provenance: v105 (commit d073438), app/persistence/training-validation.ts
// line 109 — the settings schema:
//   quickLogActivities: z.array(z.enum(["run", "swim", "bike", "ruck",
//     "circuit", "soccer", "grappling", "yoga", "water_polo"]))
//     .refine(unique).optional()
// and app/persistence/backup-tools.ts parseBackupReview, which wraps any
// schema failure as "Backup contains invalid data: ...".
//
// This reproduces only that gate (JSON shape + quick-log enum + uniqueness),
// not the full v105 parser. "walk" is absent from the v105 enum, so a v106
// default backup carrying it failed v105 import; a backup with the key
// absent passes, because the field is optional.
const V105_QUICK_LOG_ENUM = [
  "run",
  "swim",
  "bike",
  "ruck",
  "circuit",
  "soccer",
  "grappling",
  "yoga",
  "water_polo",
];

export function parseBackupReview(text: string): void {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This JSON file is incomplete or corrupt");
  }
  if (!raw || typeof raw !== "object" || !("version" in raw)) {
    throw new Error("Choose a Coach Loop JSON backup");
  }
  const settings = (raw as { settings?: unknown }).settings;
  if (settings && typeof settings === "object" && "quickLogActivities" in settings) {
    const list = (settings as { quickLogActivities?: unknown }).quickLogActivities;
    const valid =
      Array.isArray(list) &&
      list.every((value) => typeof value === "string" && V105_QUICK_LOG_ENUM.includes(value)) &&
      new Set(list).size === list.length;
    if (!valid) {
      throw new Error("Backup contains invalid data: quickLogActivities must be a unique list of v105 activities");
    }
  }
}
