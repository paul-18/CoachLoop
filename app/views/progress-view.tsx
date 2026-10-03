/* External persistence, timers, and controlled-dialog hydration intentionally update state in effects. */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useLocalDay } from "../pwa/use-local-day";

import { Activity, Backpack, BarChart3, ChevronLeft, ChevronRight, ChevronDown, Footprints, RotateCcw, Save, Scale, Waves, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { validMeasurementDate } from "../domain/training-workflow";

import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { ActivityHistory, WaistTracking, MonthlyReview } from "./training-review";

import { BodyCoverageMap, coverageColor, COVERAGE_LEVELS } from "./body-coverage-map";
import { convertWeight, parseExactReps, performedReps, strengthRecords } from "../domain/training-metrics";
import { buildExerciseTrends, dateInWindow, localDateDaysEarlier, RECENT_STRENGTH_WINDOW_DAYS, type TrendPoint, type TrendSeries } from "../domain/training-insights";
import { coverageForLastDays, targetForCoverage, unmappedExerciseNamesLastDays, type MuscleGroup } from "../domain/training-coverage";
import { weeklyTrainingSignals } from "../domain/training-snapshot";
import { benchmarkAttempts, benchmarkDueDate } from "../domain/benchmarks";
import { strengthComparisons, strengthProfile } from "../domain/strength-profile";
import { exerciseHistoryFor } from "../domain/exercise-history";

import { DEFAULT_PROGRESS_SECTIONS } from "../domain/display-preferences";
import { weeklyCards } from "../domain/weekly-cards";
import { DisplayPreferences, type UpdateSettings } from "./display-preferences";
import { localDate, type CardioEntry, type TrainingState, type Unit } from "../domain/training-types";

import { formatDate, summarizeWorkout, EmptyPanel } from "./shared";

const trendColors = ["var(--lime)", "#66c7ff", "#d59cff"];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function StrengthCoverageCard({ state }: { state: TrainingState }) {
  const coverage = useMemo(() => coverageForLastDays(state), [state]);
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const active = selected ? coverage.find((entry) => entry.muscle === selected) : undefined;
  const sources = useMemo(() => state.workouts
    .filter((workout) => workout.status === "completed" && dateInWindow(workout.date, 7))
    .flatMap((workout) => workout.exercises.flatMap((exercise) => {
      const target = targetForCoverage(exercise.name, state.exerciseMuscleOverrides);
      const credit = selected && target?.primary.includes(selected) ? 1 : selected && target?.secondary?.includes(selected) ? 0.5 : 0;
      const sets = exercise.sets.filter((set) => set.completed && !set.warmup && parseExactReps(performedReps(set)) !== null).length;
      return credit && sets ? [{ date: workout.date, exercise: exercise.name, sets, effective: sets * credit }] : [];
    })).sort((a, b) => b.date.localeCompare(a.date)), [state.workouts, state.exerciseMuscleOverrides, selected]);
  const unmappedExercises = unmappedExerciseNamesLastDays(state);
  return <section className="progress-panel coverage-panel">
    <div className="coverage-heading"><div><p className="eyebrow">Last 7 days</p><h2>Strength coverage</h2></div><div className="coverage-scale" aria-label="Coverage: charcoal is none; bronze through pale gold means more completed set credit"><span>Less</span><div className="coverage-swatches">{COVERAGE_LEVELS.map(level => <i key={level.label} style={{ background: level.color }} title={`${level.label} effective sets`} />)}</div><span>More</span></div></div>
    <p className="coverage-scale-note">Charcoal → gold: 0 · under 4 · 4–&lt;7 · 7–&lt;10 · 10+ effective sets. Coverage counts completed working sets, not effort intensity.</p><div className="coverage-illustration"><BodyCoverageMap bodyDiagram={state.settings.bodyDiagram ?? "male"} coverage={coverage} selected={selected} onSelect={setSelected} /></div>
    {active ? <><div className="coverage-detail"><div><span className="coverage-selected-label">Selected muscle</span><h3>{active.muscle}</h3><p>{active.days} training day{active.days === 1 ? "" : "s"}</p></div><strong>{active.effectiveSets % 1 ? active.effectiveSets.toFixed(1) : active.effectiveSets}<small> effective sets</small></strong></div>
    <details className="coverage-method"><summary>Where {active.muscle.toLowerCase()} credit came from</summary>{sources.length ? <div className="mt-2 space-y-1">{sources.map((item) => <p key={`${item.date}-${item.exercise}`} className="text-xs text-white/50">{formatDate(item.date)} · {item.exercise} · {item.sets} sets = {item.effective} credited</p>)}</div> : <p>No completed working sets were counted this week.</p>}</details></> : <p className="coverage-scale-note">Tap a muscle to see its effective sets and contributing exercises.</p>}
    <details className="coverage-list-disclosure"><summary>View all muscle totals</summary><div className="coverage-list">{coverage.map((entry) => <button type="button" key={entry.muscle} onClick={() => setSelected(entry.muscle)} className={entry.muscle === selected ? "active" : ""} aria-pressed={entry.muscle === selected}><i style={{ background: coverageColor(entry) }} /><span>{entry.muscle}</span><em>{entry.effectiveSets % 1 ? entry.effectiveSets.toFixed(1) : entry.effectiveSets}</em></button>)}</div></details>
    <details className="coverage-method"><summary>How exercises are matched</summary><p>The app uses built-in name rules—not ChatGPT—and your custom mappings from Settings. For example, bench press counts toward chest; rows count toward upper back. A completed working set adds 1 set to its primary muscle and 0.5 to an optional secondary muscle. Warm-ups and cardio are excluded. {unmappedExercises.length ? `${unmappedExercises.length} recent exercise name${unmappedExercises.length === 1 ? " is" : "s are"} still unmapped: ${unmappedExercises.join(", ")}.` : "Names the app cannot match are left out rather than guessed; you can assign them in Settings."}</p></details>

  </section>;
}

function StrengthProfileCard({ state }: { state: TrainingState }) {
  const unit = state.settings.defaultUnit;
  const lifts = strengthProfile(state, unit);
  const order = ["Bench press", "Squat", "Deadlift", "Overhead press", "Pull-ups"] as const;
  const comparisons = strengthComparisons.map((item) => {
    const result = lifts.get(item.lift);
    const anchor = lifts.get(item.anchor);
    const ratio = result && anchor ? result.value / anchor.value : null;
    return { ...item, ratio, missing: !result ? item.lift : !anchor ? item.anchor : null };
  });
  return <section className="progress-panel">
    <div className="progress-heading"><div><p className="eyebrow">Best completed sets · last 42 days</p><h2>Lift balance</h2><p className="mt-1 text-sm text-white/65">Compare your recent main lifts. Missing results are not a weakness.</p></div></div>
    <div className="grid gap-2 sm:grid-cols-2">{order.map((lift) => {
      const result = lifts.get(lift);
      return <div key={lift} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2.5"><span className="text-sm text-white/75">{lift}</span><span className="text-right text-sm font-bold">{result ? <>{result.display}<small className="block font-normal text-white/45">{result.date}{lift !== "Pull-ups" ? ` · ~${Math.round(result.value)} ${unit} estimated max` : ""}</small></> : <span className="font-normal text-white/40">No recent result</span>}</span></div>;
    })}</div>
    <div className="mt-3 space-y-2">{comparisons.map((item) => <p key={item.label} className="text-sm text-white/70"><strong className="text-white/90">{item.label}:</strong> {item.ratio === null ? `Need a recent ${item.missing?.toLowerCase()} result.` : `${item.ratio.toFixed(2)}× · ${item.ratio < item.guide * .9 ? "possible gap to check" : item.ratio < item.guide ? "close to the guide" : "in the guide range"}`}</p>)}</div>
    <details className="coverage-method mt-3"><summary>How these comparisons work</summary><p>These are loose training guides: squat around 1.25× bench, deadlift around 1.10× squat, and overhead press around 0.55× bench. They are not required proportions or injury predictions. A gap is flagged only when the result is more than 10% below a guide; repeat a comparable test before changing training. Estimated maxes use the Epley formula (load × (1 + reps/30)); singles use the recorded load. Estimates use exact completed sets of 1–10 reps with total barbell load. Pull-ups show bodyweight reps separately; use consistent strict form. Chin-ups and weighted or assisted pull-ups are excluded. Variants, warm-ups, incomplete sets, and older sessions are excluded.</p></details>
  </section>;
}

export function ActivityBreakdown({ state }: { state: TrainingState }) {
  const signals = weeklyTrainingSignals(state);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + index);
    return { date: localDate(day), label: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(day) };
  });
  const icons = { strength: BarChart3, run: Footprints, ruck: Backpack, water_polo: Waves, circuit: RotateCcw };
  const colors = { strength: "var(--lime)", run: "#7cbad9", ruck: "#bdd879", water_polo: "#6bcbd0", circuit: "#d0a9d9" };
  const cards = weeklyCards(state).map(card => ({ ...card, icon: icons[card.id as keyof typeof icons] ?? Activity, color: colors[card.id as keyof typeof colors] ?? "var(--lime)" }));
  return <section className="progress-panel activity-breakdown"><div className="progress-heading"><h2>Last 7 days</h2></div><div className="activity-cards">{cards.map((card) => <div key={card.title} className="activity-summary-card" style={{ "--activity-color": card.color } as React.CSSProperties}><div className="activity-summary-icon"><card.icon size={18} /></div><div className="activity-summary-text"><span>{card.title}</span><strong>{card.value}</strong><small>{card.detail}</small></div><div className="activity-week" aria-label={`${card.title} logged on ${card.dates.length} day${card.dates.length === 1 ? "" : "s"}`}>{days.map((day) => <span key={day.date} title={day.date} className={card.dates.includes(day.date) ? "logged" : ""}>{day.label}</span>)}</div></div>)}</div>{!cards.length && <p className="text-sm text-white/60">No cards selected. Use Modify Progress below to choose what to show.</p>}{cards.length > 0 && signals.overlap && <p className="weekly-overlap">Hard run or ruck and lower-body lifting logged within a day of each other.</p>}</section>;
}

export function ProgressView({ onUpdateSettings, state, onLogBodyweight, onSaveWaist, onChangeActivityType, bodyweightPromptOpen = false, onBodyweightPromptChange, calendarRequest = 0, onCalendarOpened }: { onUpdateSettings: UpdateSettings; state: TrainingState; calendarRequest?: number; onCalendarOpened?: () => void; bodyweightPromptOpen?: boolean; onBodyweightPromptChange?: (open: boolean) => void; onSaveWaist: (entry: import("../domain/training-types").WaistEntry) => void; onLogBodyweight: (weight: number, unit: Unit, date: string) => void; onChangeActivityType: (workoutId: string, activityId: string, type: CardioEntry["activityType"]) => void }) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [calendarForced, setCalendarForced] = useState(false);
  const visible = state.settings.progressSections ?? DEFAULT_PROGRESS_SECTIONS;
  const show = (section: (typeof DEFAULT_PROGRESS_SECTIONS)[number]) => visible.includes(section);
  const today = useLocalDay();
  const records = strengthRecords(state, state.settings.defaultUnit);

  const trendSeries = useMemo(() => buildExerciseTrends(state, today), [state, today]);

  const bench = trendSeries.find((series) => series.name.toLowerCase() === "barbell bench press")
    ?? trendSeries.find((series) => series.name.toLowerCase().includes("bench press"))
    ?? trendSeries[0];
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [range, setRange] = useState<"30" | "90" | "180" | "all">("90");
  const [showBodyweight, setShowBodyweight] = useState(false);
  const [compactChart, setCompactChart] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setCompactChart(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [bodyweightOpen, setBodyweightOpen] = useState(false);
  const [bodyweightValue, setBodyweightValue] = useState("");
  const [bodyweightUnit, setBodyweightUnit] = useState<Unit>(state.settings.defaultUnit);
  const [bodyweightDate, setBodyweightDate] = useState(localDate());
  const [activePoint, setActivePoint] = useState<{ exercise: string; point: TrendPoint } | null>(null);
  const [exerciseHistoryOpen, setExerciseHistoryOpen] = useState(false);
  const progressPreferencesLoaded = useRef(false);
  useEffect(() => {
    setSelectedExercises((current) => {
      const valid = current.map((key) => trendSeries.find((series) => series.key === key || series.name === key)?.key ?? "").filter(Boolean);
      if (valid.length) return valid.slice(0, 3);
      if (!progressPreferencesLoaded.current) {
        try {
          const saved = JSON.parse(localStorage.getItem("coach-loop-progress") ?? "null") as { exercises?: string[]; range?: "30" | "90" | "180" | "all" } | null;
          const savedExercises = saved?.exercises?.map((key) => trendSeries.find((series) => series.key === key || series.name === key)?.key ?? "").filter(Boolean).slice(0, 3) ?? [];
          if (saved?.range && ["30", "90", "180", "all"].includes(saved.range)) setRange(saved.range);
          progressPreferencesLoaded.current = true;
          if (savedExercises.length) return savedExercises;
        } catch {
          progressPreferencesLoaded.current = true;
        }
      }
      return bench ? [bench.key] : [];
    });
  }, [bench, trendSeries]);
  useEffect(() => {
    if (!progressPreferencesLoaded.current) return;
    try { localStorage.setItem("coach-loop-progress", JSON.stringify({ exercises: selectedExercises, range })); } catch { /* Optional preferences never block logging. */ }
  }, [selectedExercises, range]);

  const selectedSeries = selectedExercises.map((key) => trendSeries.find((series) => series.key === key)).filter((series): series is TrendSeries => Boolean(series));
  const selectedKey = selectedExercises[0];
  const exerciseHistory = useMemo(() => selectedKey ? exerciseHistoryFor(state, selectedKey) : [], [state, selectedKey]);
  const cutoff = range === "all" ? null : localDateDaysEarlier(Number(range) - 1, today);
  const visibleSeries = selectedSeries.map((series) => ({ ...series, points: series.points.filter((point) => !cutoff || point.date >= cutoff) }));
  const visiblePoints = visibleSeries.flatMap((series) => series.points);
  const bodyweightPoints = state.bodyweightEntries
    .filter((entry) => entry.date <= today && (!cutoff || entry.date >= cutoff))
    .map((entry) => ({ ...entry, value: convertWeight(entry.weight, entry.unit, state.settings.defaultUnit) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt));
  const metric = selectedSeries[0]?.metric ?? "e1rm";
  const chartDates = [...visiblePoints, ...(showBodyweight ? bodyweightPoints : [])].map((point) => new Date(`${point.date}T12:00:00`).getTime());
  const minDate = chartDates.length ? Math.min(...chartDates) : 0;
  const maxDateRaw = chartDates.length ? Math.max(...chartDates) : 1;
  const maxDate = maxDateRaw === minDate ? minDate + 86400000 : maxDateRaw;
  const rawMinValue = visiblePoints.length ? Math.min(...visiblePoints.map((point) => point.value)) : 0;
  const rawMaxValue = visiblePoints.length ? Math.max(...visiblePoints.map((point) => point.value)) : 1;
  const valuePad = Math.max((rawMaxValue - rawMinValue) * 0.12, metric === "reps" ? 1 : 2.5);
  const minValue = Math.max(0, rawMinValue - valuePad);
  const maxValue = rawMaxValue + valuePad;
  const chart = { width: compactChart ? 360 : 760, height: compactChart ? 260 : 300, left: compactChart ? 40 : 58, right: showBodyweight && bodyweightPoints.length ? compactChart ? 42 : 58 : 18, top: 18, bottom: 42 };
  const pointX = (date: string) => chart.left + ((new Date(`${date}T12:00:00`).getTime() - minDate) / (maxDate - minDate)) * (chart.width - chart.left - chart.right);
  const pointY = (value: number) => chart.top + (1 - (value - minValue) / Math.max(1, maxValue - minValue)) * (chart.height - chart.top - chart.bottom);
  const bodyMin = bodyweightPoints.length ? Math.min(...bodyweightPoints.map((point) => point.value)) : 0;
  const bodyMaxRaw = bodyweightPoints.length ? Math.max(...bodyweightPoints.map((point) => point.value)) : 1;
  const bodyPad = Math.max((bodyMaxRaw - bodyMin) * 0.12, 1);
  const bodyMax = bodyMaxRaw + bodyPad;
  const bodyFloor = Math.max(0, bodyMin - bodyPad);
  const bodyY = (value: number) => chart.top + (1 - (value - bodyFloor) / Math.max(1, bodyMax - bodyFloor)) * (chart.height - chart.top - chart.bottom);
  const latestBodyweight = [...state.bodyweightEntries].filter((entry) => entry.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const currentBodyweight = latestBodyweight ? convertWeight(latestBodyweight.weight, latestBodyweight.unit, state.settings.defaultUnit) : null;
  const priorMonthWeight = [...state.bodyweightEntries].filter((entry) => entry.date >= localDateDaysEarlier(29, today) && entry.date <= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const monthWeightDelta = priorMonthWeight && latestBodyweight && priorMonthWeight.id !== latestBodyweight.id ? currentBodyweight! - convertWeight(priorMonthWeight.weight, priorMonthWeight.unit, state.settings.defaultUnit) : null;
  const latestWaist = [...(state.waistEntries ?? [])].filter((entry) => !entry.deletedAt && entry.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const recentLiftRecords = strengthRecords(state, state.settings.defaultUnit, localDateDaysEarlier(RECENT_STRENGTH_WINDOW_DAYS - 1, today));
  const relativeLifts = [...recentLiftRecords].filter(([name]) => /bench press|squat|deadlift|overhead press/i.test(name)).slice(0, 4);
  const openBodyweightDialog = () => {
    setBodyweightDate(localDate());
    setBodyweightUnit(state.settings.defaultUnit);
    setBodyweightValue(latestBodyweight ? String(Number(convertWeight(latestBodyweight.weight, latestBodyweight.unit, state.settings.defaultUnit).toFixed(1))) : "");
    setBodyweightOpen(true);
  };
  useEffect(() => {
    if (bodyweightPromptOpen) {
      setBodyweightDate(localDate()); setBodyweightUnit(state.settings.defaultUnit);
      setBodyweightValue(latestBodyweight ? String(Number(convertWeight(latestBodyweight.weight, latestBodyweight.unit, state.settings.defaultUnit).toFixed(1))) : "");
      setBodyweightOpen(true);
    }
  }, [bodyweightPromptOpen, state.settings.defaultUnit, latestBodyweight]);
  const closeBodyweightDialog = () => { setBodyweightOpen(false); onBodyweightPromptChange?.(false); };

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const calendarRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (calendarRequest) setCalendarForced(true);
    if (!calendarRequest || !calendarRef.current) return;
    setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    calendarRef.current.open = true;
    const frame = requestAnimationFrame(() => {
      calendarRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      onCalendarOpened?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [calendarRequest, onCalendarOpened, calendarForced]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const firstOffset = (calendarMonth.getDay() + 6) % 7;
  const calendarStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1 - firstOffset);
  const calendarDays = Array.from({ length: 42 }, (_, index) => { const day = new Date(calendarStart); day.setDate(day.getDate() + index); return day; });
  const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const activityWorkouts = state.workouts.filter((workout) => workout.status === "completed" || workout.status === "skipped");
  const selectedDayWorkouts = selectedDate ? activityWorkouts.filter((workout) => workout.date === selectedDate) : [];

  return (
    <div className="page-stack">
      <section className="topline"><h1>Progress</h1></section>
      {show("weekly") && <ActivityBreakdown state={state} />}
      {show("coverage") && <StrengthCoverageCard state={state} />}
      {show("balance") && <StrengthProfileCard state={state} />}
      {show("bodyweight") && <section className="progress-panel">
        <div className="bodyweight-quicklog"><div><p className="eyebrow">Bodyweight</p><h2>{latestBodyweight ? `${latestBodyweight.weight} ${latestBodyweight.unit}` : "No bodyweight logged"}</h2><p className="mt-1 text-sm text-white/45">{latestBodyweight ? `Last logged ${dateLabel(latestBodyweight.date)}` : "Log when it suits you."}</p></div><Button type="button" onClick={openBodyweightDialog} aria-label="Log bodyweight" className="bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90"><Scale /> Log</Button></div>
        {(monthWeightDelta !== null || latestWaist) && <p className="body-composition-line">{monthWeightDelta !== null ? `${monthWeightDelta > 0 ? "+" : ""}${Number(monthWeightDelta.toFixed(1))} ${state.settings.defaultUnit} across logged dates this month` : ""}{monthWeightDelta !== null && latestWaist ? " · " : ""}{latestWaist ? `Waist ${Number(latestWaist.cm.toFixed(1))} cm (${dateLabel(latestWaist.date)})` : ""}</p>}
        {currentBodyweight && relativeLifts.length > 0 && <details className="relative-lifts"><summary>Recent main lifts relative to bodyweight</summary><div>{relativeLifts.map(([name, record]) => <p key={name}><span>{name}</span><strong>{Math.round(record.e1rm)} {state.settings.defaultUnit} est. · {(record.e1rm / currentBodyweight).toFixed(2)}× BW</strong></p>)}</div><small>Recent e1RM ÷ bodyweight logged {latestBodyweight?.date}; dates may differ. See the exercise chart for the underlying sets.</small></details>}
      </section>}
      {show("trends") && <section className="progress-panel exercise-trend-panel">
        <div className="progress-heading"><div><p className="eyebrow">Exercise trend</p><h2>{metric === "e1rm" ? `Recent estimated strength (${state.settings.defaultUnit})` : metric === "load" ? `Best load (${state.settings.defaultUnit})` : "Best completed reps"}</h2>{metric === "e1rm" && <p className="mt-1 text-xs text-white/42">Best valid top set in the last {RECENT_STRENGTH_WINDOW_DAYS} days—easy work cannot lower it.</p>}</div><div className="range-switch">{(["30", "90", "180", "all"] as const).map((value) => <button key={value} type="button" className={range === value ? "active" : ""} onClick={() => setRange(value)}>{value === "180" ? "6M" : value === "all" ? "All" : `${value}D`}</button>)}</div></div>
        {trendSeries.length ? (
          <>
            <div className="trend-controls">
              <NativeSelect value="" aria-label="Add exercise to chart" onChange={(event) => { const key = event.target.value; if (key && !selectedExercises.includes(key) && selectedExercises.length < 3) { setSelectedExercises([...selectedExercises, key]); setActivePoint(null); } }}>
                <NativeSelectOption value="">{selectedExercises.length >= 3 ? "Three selected" : "Add exercise…"}</NativeSelectOption>
                {trendSeries.filter((series) => !selectedExercises.includes(series.key) && (!selectedSeries[0] || series.metric === selectedSeries[0].metric)).map((series) => <NativeSelectOption key={series.key} value={series.key}>{series.name}</NativeSelectOption>)}
              </NativeSelect>
              <div className="trend-legend">{selectedSeries.map((series, index) => <button key={series.key} type="button" onClick={() => { setSelectedExercises(selectedExercises.filter((item) => item !== series.key)); setActivePoint(null); }} style={{ "--series-color": trendColors[index] } as React.CSSProperties} aria-label={`Remove ${series.name} from chart`}><i className="trend-series-dot" /><span className="trend-series-name" title={series.name}>{series.name}</span><X /></button>)}</div>
              {bodyweightPoints.length > 0 && <button type="button" onClick={() => setShowBodyweight((value) => !value)} className={showBodyweight ? "trend-bodyweight-toggle active" : "trend-bodyweight-toggle"}><i />Bodyweight</button>}
            </div>
            {visiblePoints.length ? (
              <>
                <div className="trend-chart" aria-label="Exercise progress chart">
                  <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="group" aria-label="Training progress chart">
                    {[0, 1, 2, 3, 4].map((step) => { const value = minValue + ((maxValue - minValue) * step) / 4; const y = pointY(value); return <g key={step}><line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} className="trend-gridline" /><text x={chart.left - 10} y={y + 4} textAnchor="end" className="trend-axis-label">{Math.round(value)}</text></g>; })}
                    {visibleSeries.map((series, index) => {
                      const path = series.points.map((point, pointIndex) => `${pointIndex ? "L" : "M"}${pointX(point.date)},${pointY(point.value)}`).join(" ");
                      return <g key={series.key}><path d={path} fill="none" stroke={trendColors[index]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{series.points.map((point) => <g key={`${series.key}-${point.date}`} className="trend-point"><circle cx={pointX(point.date)} cy={pointY(point.value)} r="26" fill="transparent" role="button" tabIndex={0} aria-label={`${series.name}, ${dateLabel(point.date)}: ${point.setLabel}`} onClick={() => setActivePoint({ exercise: series.name, point })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActivePoint({ exercise: series.name, point }); } }}><title>{`${series.name}, ${dateLabel(point.date)}: ${point.setLabel}`}</title></circle><circle cx={pointX(point.date)} cy={pointY(point.value)} r="6" fill={trendColors[index]} stroke="#10120f" strokeWidth="3" pointerEvents="none" /></g>)}</g>;
                    })}
                    {showBodyweight && bodyweightPoints.length > 0 && <><path d={bodyweightPoints.map((point, index) => `${index ? "L" : "M"}${pointX(point.date)},${bodyY(point.value)}`).join(" ")} fill="none" stroke="#ffb84d" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" />{bodyweightPoints.map((point) => <circle key={`bodyweight-${point.id}`} cx={pointX(point.date)} cy={bodyY(point.value)} r="4.5" fill="#ffb84d" stroke="#10120f" strokeWidth="2" />)}{[0, 1, 2, 3, 4].map((step) => { const value = bodyFloor + ((bodyMax - bodyFloor) * step) / 4; const y = bodyY(value); return <text key={`body-axis-${step}`} x={chart.width - chart.right + 10} y={y + 4} className="trend-axis-label" fill="#ffb84d">{Math.round(value)}</text>; })}</>}
                    <text x={chart.left} y={chart.height - 10} className="trend-axis-label">{dateLabel(localDate(new Date(minDate)))}</text>
                    <text x={chart.width - chart.right} y={chart.height - 10} textAnchor="end" className="trend-axis-label">{dateLabel(localDate(new Date(maxDateRaw)))}</text>
                  </svg>
                </div>
                <div className="trend-detail">{activePoint ? <><strong title={activePoint.exercise}>{activePoint.exercise}</strong><span>{dateLabel(activePoint.point.date)} · {activePoint.point.setLabel}{activePoint.point.effort ? ` · ${activePoint.point.effort}` : ""}</span></> : <span>Tap a point to see the recorded set.</span>}</div>
                {showBodyweight && bodyweightPoints.length > 0 && <p className="mt-2 text-xs text-amber-200/65">Dashed gold line: bodyweight · right-hand scale.</p>}
              </>
            ) : <div className="trend-empty">{selectedExercises.length ? "No unambiguous entries in this time range. Try All." : "Choose an exercise to display."}</div>}
            {selectedSeries[0] && exerciseHistory.length > 0 && <Button type="button" variant="outline" className="exercise-trend-history-button mt-2 border-white/10 bg-transparent text-white" aria-label={`View ${selectedSeries[0].name} history`} onClick={() => setExerciseHistoryOpen(true)}>View exercise history</Button>}
          </>
        ) : <EmptyPanel icon={BarChart3} title="Your chart starts with one completed set" text="Record actual reps and, for weighted exercises, weight. Bodyweight movements chart best reps instead." />}
      </section>}
      <Dialog open={exerciseHistoryOpen} onOpenChange={setExerciseHistoryOpen}><DialogContent className="max-h-[85dvh] min-w-0 overflow-y-auto border-white/10 bg-[#151713] text-white sm:max-w-md"><DialogHeader><DialogTitle className="exercise-history-title">{selectedSeries[0]?.name ?? "Exercise"} history</DialogTitle><DialogDescription className="text-white/50">Completed sets from all recorded sessions, including labelled warm-ups. Planned and skipped work is excluded.</DialogDescription></DialogHeader><div className="space-y-3">{exerciseHistory.map((entry) => <section key={entry.id} className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-3"><p className="exercise-history-session text-xs text-white/55">{formatDate(entry.date)} · {entry.workoutName}</p><ul className="mt-2 space-y-1.5">{entry.sets.map((set, index) => <li key={index} className="break-words text-sm text-white/80">{set}</li>)}</ul></section>)}</div></DialogContent></Dialog>
      <Dialog open={bodyweightOpen} onOpenChange={(open) => { setBodyweightOpen(open); if (!open) onBodyweightPromptChange?.(false); }}>
        <DialogContent className="border-white/10 bg-[#151713] text-white sm:max-w-md"><DialogHeader className="text-left"><DialogTitle>Log bodyweight</DialogTitle><DialogDescription className="text-white/48">One optional measurement. Logging the same date updates that day’s entry.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-[1fr_110px]"><label className="field-label">Weight<Input value={bodyweightValue} onChange={(event) => setBodyweightValue(event.target.value)} inputMode="decimal" pattern="[0-9.]*" placeholder="180" className="mt-2 border-white/10 bg-black/20" /></label><label className="field-label">Unit<NativeSelect value={bodyweightUnit} onChange={(event) => setBodyweightUnit(event.target.value as Unit)} className="mt-2 w-full border-white/10 bg-black/20 text-white"><NativeSelectOption value="lb">lb</NativeSelectOption><NativeSelectOption value="kg">kg</NativeSelectOption></NativeSelect></label><label className="field-label sm:col-span-2">Date<Input type="date" max={today} value={bodyweightDate} onChange={(event) => setBodyweightDate(event.target.value)} className="mt-2 border-white/10 bg-black/20" /></label></div><DialogFooter><Button variant="outline" onClick={closeBodyweightDialog} className="border-white/10 bg-transparent text-white">Cancel</Button><Button onClick={() => { const value = Number(bodyweightValue); if (!Number.isFinite(value) || value <= 0 || value > 1500) return toast.error("Enter a realistic bodyweight"); if (!validMeasurementDate(bodyweightDate) || bodyweightDate > today) return toast.error("Use a valid date that is not in the future"); onLogBodyweight(value, bodyweightUnit, bodyweightDate); closeBodyweightDialog(); }} className="bg-[var(--lime)] font-black text-[#11140d] hover:bg-[var(--lime)]/90"><Save /> Save bodyweight</Button></DialogFooter></DialogContent>
      </Dialog>

      {show("benchmarks") && (state.benchmarks ?? []).some((item) => !item.deletedAt) && <details className="page-disclosure"><summary><span>Pinned benchmarks<small>Explicit results and re-test dates</small></span><ChevronDown /></summary><div className="feature-panel">{(state.benchmarks ?? []).filter((item) => !item.deletedAt).map((item) => { const attempts = benchmarkAttempts(item); const previous = attempts.slice(1).find((entry) => entry.protocol === attempts[0]?.protocol); return <div key={item.id} className="benchmark-row"><strong>{item.name}</strong>{item.protocol && <p className="text-xs text-white/50">{item.protocol}</p>}<p>{attempts[0] ? `${attempts[0].result} · ${attempts[0].date}` : "No result yet"}{benchmarkDueDate(item) ? ` · re-test ${benchmarkDueDate(item)}` : ""}</p>{previous && <p className="text-xs text-white/50">Previous same protocol: {previous.result} · {previous.date}</p>}</div>; })}<p className="text-xs text-white/45">Update results and intervals in Settings. Ordinary sessions are not counted as tests.</p></div></details>}

      {show("activities") && <ActivityHistory state={state} onChangeActivityType={onChangeActivityType} />}
      {show("waist") && <WaistTracking state={state} onSave={onSaveWaist} />}
      {show("monthly") && <MonthlyReview state={state} />}
      {(show("calendar") || calendarForced || calendarRequest > 0) && <details ref={calendarRef} className="page-disclosure training-calendar-disclosure"><summary><span>Training calendar<small>Browse completed and skipped days</small></span><ChevronDown /></summary><section className="progress-panel">
        <div className="progress-heading"><div><h2>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarMonth)}</h2></div><div className="calendar-nav"><button type="button" aria-label="Previous month" onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)); setSelectedDate(null); }}><ChevronLeft /></button><button type="button" aria-label="Next month" onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)); setSelectedDate(null); }}><ChevronRight /></button></div></div>
        <div className="calendar-legend"><span className="strength">Strength</span><span className="cardio">Cardio</span><span className="skipped">Skipped</span></div>
        <div className="activity-calendar">
          {['M','T','W','T','F','S','S'].map((label, index) => <span key={`${label}-${index}`} className="calendar-weekday">{label}</span>)}
          {calendarDays.map((day) => {
            const key = dayKey(day); const workouts = activityWorkouts.filter((workout) => workout.date === key);
            const markers = workouts.flatMap((workout) => workout.status === "skipped" ? ["skipped"] : [workout.exercises.some((exercise) => exercise.sets.some((set) => set.completed)) ? "strength" : null, workout.cardio.some((item) => item.completed) ? "cardio" : null].filter(Boolean) as string[]);
            return <button key={key} type="button" aria-label={`${dateLabel(key)}: ${workouts.length ? workouts.map((w) => `${w.name}, ${w.status}`).join("; ") : "No training recorded"}`} aria-pressed={selectedDate === key} className={`calendar-day ${day.getMonth() !== calendarMonth.getMonth() ? "outside" : ""} ${selectedDate === key ? "selected" : ""}`} onClick={() => setSelectedDate(key)}><span>{day.getDate()}</span><span className="calendar-markers">{markers.slice(0, 4).map((marker, index) => <i key={`${marker}-${index}`} className={marker} />)}</span></button>;
          })}
        </div>
        {selectedDate && <div className="calendar-detail"><strong>{dateLabel(selectedDate)}</strong>{selectedDayWorkouts.length ? selectedDayWorkouts.map((workout) => <span key={workout.id}>{workout.name}{workout.status === "skipped" ? ` · Skipped${workout.skipReason ? `: ${workout.skipReason}` : ""}` : ` · ${summarizeWorkout(workout)}`}</span>) : <span>No activity recorded.</span>}</div>}
      </section></details>}

      {show("records") && <details className="page-disclosure">
        <summary><span>Exercise records<small>Best logged strength estimates · {records.size} lifts</small></span><ChevronDown /></summary>
        {records.size ? <div className="grid gap-3 sm:grid-cols-2">{[...records.entries()].sort((a, b) => b[1].e1rm - a[1].e1rm).map(([name, record]) => <div key={name} className="record-card"><div><p>{name}</p><small>Best unambiguous set</small></div><strong>{record.display}</strong><span>Estimated max {Math.round(record.e1rm)} {state.settings.defaultUnit}</span></div>)}</div> : <EmptyPanel icon={BarChart3} title="Records appear after completed sets" text="Enter an exact rep count and load meaning, then mark the set complete. Rep ranges and totals are kept in history but excluded from strength estimates." />}
      </details>}
      <div className="progress-modify"><Button variant="outline" onClick={() => { setCalendarForced(false); setCustomizeOpen(true); }}>Modify Progress</Button><p className="mt-2 text-xs text-white/50">Choose the cards and sections you want to see.</p></div>
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto border-white/10 bg-[#151713] text-white sm:max-w-xl"><DialogHeader><DialogTitle>Modify Progress</DialogTitle><DialogDescription className="text-white/60">Selections save automatically. Hiding a section keeps its data.</DialogDescription></DialogHeader><DisplayPreferences settings={state.settings} onUpdate={onUpdateSettings} showColors={false} /><DialogFooter><Button onClick={() => setCustomizeOpen(false)}>Done</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
