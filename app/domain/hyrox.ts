import { makeWorkout, makeCardio, type WorkoutSession, type Unit } from "./training-types";

export const HYROX_RULEBOOK = "https://maintain.hyrox.com/rulebooks/HYROX_RulebookSingles_EN.pdf";
export const HYROX_SEASON = "2026/27";
export const HYROX_DIVISIONS = { men_open: "Men Open", women_open: "Women Open", men_pro: "Men Pro", women_pro: "Women Pro" } as const;
export type HyroxDivision = keyof typeof HYROX_DIVISIONS;
export type HyroxSegment = {
  id: string; kind: "run" | "station"; name: string; distanceM: number | null; reps: number | null;
  loadKg: number | null; loadCount: number; targetM: number | null; cue: string;
  splitMs: number | null; corrected?: boolean;
};
export type HyroxSession = {
  version: 1; division: HyroxDivision; season: string; setupLabel?: string; focused?: boolean; segments: HyroxSegment[];
  runningSince: number | null; segmentElapsedMs: number; started: boolean;
  modified: boolean; paused: boolean; endedEarly: boolean;
};

// Singles table and wall-ball target heights: official 2026/27 rulebook, pp. 8 and 35.
export function hyroxPreset(division: HyroxDivision): HyroxSegment[] {
  const tier = division === "women_open" ? 0 : division === "men_pro" ? 2 : 1;
  const stations = [
    { name: "SkiErg", distanceM: 1000, cue: "Finish 1,000 m on the monitor." },
    { name: "Sled Push", distanceM: 50, loadKg: [102,152,202][tier], cue: "4 × 12.5 m. Load includes the sled; subtract your sled's weight for plates. Fully cross each line. Turf changes resistance." },
    { name: "Sled Pull", distanceM: 50, loadKg: [78,103,153][tier], cue: "4 × 12.5 m. Load includes the sled. Pull standing with a rope; fully cross each line." },
    { name: "Burpee Broad Jumps", distanceM: 80, cue: "Chest to floor on each burpee; two-foot take-off and landing. Measure the distance." },
    { name: "Row", distanceM: 1000, cue: "Finish 1,000 m on the rower monitor." },
    { name: "Farmers Carry", distanceM: 200, loadKg: [16,24,32][tier], loadCount: 2, cue: "Two kettlebells, one in each hand. Complete the distance and return both to the start area." },
    { name: "Sandbag Lunges", distanceM: 100, loadKg: [10,20,30][tier], cue: "Sandbag on shoulders. Alternate legs, trailing knee touches down; stand fully between reps." },
    { name: "Wall Balls", reps: 100, loadKg: [4,6,9][tier], targetM: division.startsWith("women") ? 2.7 : 3, cue: "Squat below parallel, then hit the target. Count only valid reps." },
  ];
  return stations.flatMap((station, index) => [
    { id: `run-${index+1}`, kind: "run" as const, name: `Run ${index+1}`, distanceM: 1000, reps: null, loadKg: null, loadCount: 1, targetM: null, cue: "Complete 1 km on your measured route or treadmill.", splitMs: null },
    { id: `station-${index+1}`, kind: "station" as const, distanceM: null, reps: null, loadKg: null, loadCount: 1, targetM: null, ...station, splitMs: null },
  ]);
}
export function hyroxPrescription(segment: HyroxSegment, unit: Unit = "kg") {
  const weight = segment.loadKg === null ? "" : unit === "kg" ? `${segment.loadKg} kg` : `≈${(segment.loadKg * 2.2046226218).toFixed(1)} lb`;
  return [segment.distanceM !== null ? `${segment.distanceM.toLocaleString()} m` : "", segment.reps !== null ? `${segment.reps} reps` : "", weight ? `${segment.loadCount === 2 ? "2 × " : ""}${weight}${/sled/i.test(segment.name) ? " incl. sled" : ""}` : "", segment.targetM !== null ? `${segment.targetM} m target` : ""].filter(Boolean).join(" · ");
}
export function makeHyroxWorkout(division: HyroxDivision, segments = hyroxPreset(division), setupLabel = ""): WorkoutSession {
  if (!segments.length) throw new Error("Choose at least one segment");
  const workout = makeWorkout("kg", 90, `HYROX${segments.length !== 16 ? " practice" : ""} · ${HYROX_DIVISIONS[division]}`);
  const preset = hyroxPreset(division);
  workout.exercises = [];
  workout.status = "planned";
  workout.startedAt = null;
  const copied = segments.map((s) => ({ ...s, splitMs: null, corrected: false }));
  workout.cardio = copied.map((s) => {
    const activity = makeCardio(s.kind === "run" ? "run" : s.name === "Row" ? "row" : "circuit");
    s.id = activity.id;
    return { ...activity, name: s.name, plannedDistanceKm: s.distanceM === null ? null : s.distanceM / 1000, coachNotes: `${hyroxPrescription(s)}. ${s.cue}` };
  });
  workout.blockOrder = workout.cardio.map((item) => ({ type: "activity", id: item.id }));
  workout.hyrox = { version: 1, division, season: HYROX_SEASON, setupLabel: setupLabel.trim(), focused: segments.length !== 16, segments: copied, runningSince: null, segmentElapsedMs: 0, started: false, modified: segments.length !== preset.length || segments.some((s,i) => !preset[i] || ["name","distanceM","reps","loadKg","loadCount","targetM"].some((key) => s[key as keyof HyroxSegment] !== preset[i][key as keyof HyroxSegment])), paused: false, endedEarly: false };
  return workout;
}
export const hyroxCurrentIndex = (session: HyroxSession) => session.segments.findIndex((segment) => segment.splitMs === null);
export const hyroxSegmentElapsed = (session: HyroxSession, now = Date.now()) => session.segmentElapsedMs + (session.runningSince === null ? 0 : Math.max(0, now - session.runningSince));
export const hyroxTotal = (session: HyroxSession, now = Date.now()) => session.segments.reduce((sum, segment) => sum + (segment.splitMs ?? 0), 0) + hyroxSegmentElapsed(session, now);
export const hyroxTime = (ms: number) => { const s = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2,"0")}`; };
export function updateHyrox(workout: WorkoutSession, action: "start" | "pause" | "complete" | "undo" | "end", now = Date.now()): WorkoutSession {
  if (!workout.hyrox) return workout;
  const session = structuredClone(workout.hyrox);
  const current = hyroxCurrentIndex(session);
  if (action === "start" && current >= 0 && session.runningSince === null && !workout.completedAt) { session.runningSince = now; session.started = true; }
  if (action === "pause" && session.runningSince !== null) { session.segmentElapsedMs = hyroxSegmentElapsed(session, now); session.runningSince = null; session.paused = true; }
  if (action === "complete" && current >= 0 && session.runningSince !== null) {
    session.segments[current].splitMs = hyroxSegmentElapsed(session, now);
    session.segmentElapsedMs = 0;
    session.runningSince = current === session.segments.length - 1 ? null : now;
  }
  if (action === "undo") {
    const last = current < 0 ? session.segments.length - 1 : current - 1;
    if (last >= 0 && !workout.completedAt) {
      session.segmentElapsedMs = hyroxSegmentElapsed(session, now) + (session.segments[last].splitMs ?? 0);
      session.segments[last].splitMs = null;
      session.runningSince = session.runningSince === null ? null : now;
    }
  }
  if (action === "end") {
    session.segmentElapsedMs = hyroxSegmentElapsed(session, now);
    session.runningSince = null;
    session.endedEarly = current >= 0;
  }
  return applyHyrox(workout, session, now);
}
export function applyHyrox(workout: WorkoutSession, session: HyroxSession, now = Date.now()): WorkoutSession {
  const timestamp = new Date(now).toISOString();
  return { ...workout, hyrox: session, updatedAt: timestamp, cardio: workout.cardio.map((item) => {
    const s = session.segments.find((segment) => segment.id === item.id);
    if (!s) return item;
    return { ...item, completed: s.splitMs !== null, completedAsPlanned: false, actualDurationMin: s.splitMs === null ? null : Number((s.splitMs / 60000).toFixed(4)), actualDistanceKm: s.splitMs === null || s.distanceM === null ? null : s.distanceM / 1000, updatedAt: timestamp };
  }) };
}
export function correctHyroxSplit(workout: WorkoutSession, id: string, ms: number) {
  if (!workout.hyrox || !Number.isFinite(ms) || ms <= 0) return workout;
  const session = structuredClone(workout.hyrox);
  const segment = session.segments.find((s) => s.id === id);
  if (!segment || segment.splitMs === null) return workout;
  segment.splitMs = ms; segment.corrected = true;
  return applyHyrox(workout, session);
}
export const hyroxSummary = (session: HyroxSession) => `${HYROX_DIVISIONS[session.division]}${session.focused ? " · Focused practice" : ""} · ${session.endedEarly ? "Partial" : hyroxCurrentIndex(session) < 0 ? "Complete" : "In progress"} · ${hyroxTime(hyroxTotal(session))}${session.modified ? " · Modified setup" : ""}${session.paused ? " · Pauses excluded" : ""}`;

export function hyroxExport(workout: WorkoutSession, includePlanned = false): string[] {
  if (!workout.hyrox) return [];
  const session = workout.hyrox;
  return [
    `HYROX gym simulation · ${session.season} · ${workout.status === "planned" ? `${HYROX_DIVISIONS[session.division]} · PLANNED` : hyroxSummary(session)}`,
    "Self-timed; transitions included in the next split.",
    ...(session.setupLabel ? [`Gym / route: ${session.setupLabel}`] : []),
    ...session.segments.filter((s) => includePlanned || s.splitMs !== null).map((s) => `${s.name}: ${hyroxPrescription(s)} · ${s.splitMs === null ? workout.status === "planned" ? "PLANNED" : "NOT COMPLETED" : hyroxTime(s.splitMs)}${s.corrected ? " (corrected)" : ""}`),
    ...(session.endedEarly && session.segmentElapsedMs > 0 ? [`Unfinished segment: ${hyroxTime(session.segmentElapsedMs)} elapsed; no completion or distance credited.`] : []),
  ];
}

/** Comparisons require an identical sequence and prescription, complete results and the same pause category. */
export function hyroxComparisonKey(session: HyroxSession) {
  return JSON.stringify([session.division, session.season, session.setupLabel?.trim().toLowerCase() ?? "", session.paused,
    session.segments.map(s => [s.kind,s.name.trim().toLowerCase(),s.distanceM,s.reps,s.loadKg,s.loadCount,s.targetM])]);
}
export function comparableHyrox(workout: WorkoutSession, history: WorkoutSession[]) {
  const h = workout.hyrox;
  if (!h || h.endedEarly || h.segments.some(s=>s.splitMs===null)) return [];
  return history.filter(w=>w.id!==workout.id && w.status==='completed' && w.date<=workout.date && w.hyrox && !w.hyrox.endedEarly && w.hyrox.segments.every(s=>s.splitMs!==null) && hyroxComparisonKey(w.hyrox)===hyroxComparisonKey(h))
    .sort((a,b)=>b.date.localeCompare(a.date)||(b.completedAt??'').localeCompare(a.completedAt??''));
}
