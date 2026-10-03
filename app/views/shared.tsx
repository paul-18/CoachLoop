"use client";
import { APP_RELEASE } from "../app-release";

import { Activity, BarChart3, Bot, Dumbbell, History, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

import { hyroxSummary } from "../domain/hyrox";

import { type SyncStatus } from "../persistence/cloud-sync";

import { type CardioEntry, type ExerciseBlock, type WorkoutSession } from "../domain/training-types";

import { performedDuration, performedDistance, hasCompletedActivityWork } from "../domain/completion";
import { normalizedBlockOrder } from "../domain/block-order";
export type MainView = "today" | "history" | "coach" | "progress" | "settings";

export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
};

/** Keeps a partially typed decimal (for example `52.`) intact until the field blurs. */
export function DecimalInput({
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
}) {
  const [raw, setRaw] = useState(value === null ? "" : String(value));
  const focused = useRef(false);
  const dirty = useRef(false);
  const lastSubmitted = useRef<number | null | undefined>(undefined);
  const baseline = useRef(value);
  const clamp = (candidate: number) => {
    const min = typeof props.min === "number" ? props.min : typeof props.min === "string" ? Number(props.min) : -Infinity;
    const max = typeof props.max === "number" ? props.max : typeof props.max === "string" ? Number(props.max) : Infinity;
    return Math.min(Number.isFinite(max) ? max : Infinity, Math.max(Number.isFinite(min) ? min : -Infinity, candidate));
  };
  useEffect(() => {
    if (!focused.current || !dirty.current || (value !== baseline.current && value !== lastSubmitted.current)) {
      dirty.current = false;
      setRaw(value === null ? "" : String(value));
    }
    baseline.current = value;
  }, [value]);
  return (
    <Input
      {...props}
      inputMode="decimal"
      value={raw}
      onFocus={(event) => {
        focused.current = true;
        baseline.current = value;
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        focused.current = false;
        const parsed = raw === "" || raw === "." || raw === "-" ? null : Number(raw);
        if (parsed !== null && !Number.isFinite(parsed)) {
          setRaw(value === null ? "" : String(value));
        } else if (dirty.current) {
          const bounded = parsed === null ? null : clamp(parsed);
          if (bounded !== lastSubmitted.current) onValueChange(bounded);
          setRaw(bounded === null ? "" : String(bounded));
        }
        dirty.current = false;
        lastSubmitted.current = undefined;
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^-?\d*\.?\d*$/.test(next)) return;
        setRaw(next);
        dirty.current = true;
        const parsed = next === "" || next === "." || next === "-" ? null : Number(next);
        if (parsed === null || Number.isFinite(parsed)) {
          const bounded = parsed === null ? null : clamp(parsed);
          lastSubmitted.current = bounded;
          onValueChange(bounded);
        }
      }}
    />
  );
}

export const downloadText = (text: string, filename: string, type: string) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(date).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(`${date}T12:00:00`));

export const formatDuration = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

export const summarizeWorkout = (workout: WorkoutSession) => {
  if (workout.hyrox) return hyroxSummary(workout.hyrox);
  const sets = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0,
  );
  const activities = workout.cardio.filter(hasCompletedActivityWork);
  const duration = activities.reduce(
    (sum, activity) => sum + (performedDuration(activity) ?? 0),
    0,
  );
  const distance = activities.reduce(
    (sum, activity) => sum + (performedDistance(activity) ?? 0),
    0,
  );
  const pieces = [];
  if (workout.exercises.length) {
    pieces.push(`${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}`);
  }
  if (sets) pieces.push(`${sets} completed set${sets === 1 ? "" : "s"}`);
  if (duration) pieces.push(`${duration.toFixed(duration % 1 ? 1 : 0)} cardio min`);
  if (distance) pieces.push(`${distance.toFixed(distance % 1 ? 2 : 0)} km`);
  if (activities.length && !duration && !distance) {
    pieces.push(`${activities.length} activit${activities.length === 1 ? "y" : "ies"}`);
  }
  return pieces.join(" · ") || "No work recorded";
};

export type OrderedWorkoutBlock =
  | { type: "exercise"; exercise: ExerciseBlock }
  | { type: "activity"; activity: CardioEntry };

export const orderedWorkoutBlocks = (workout: WorkoutSession): OrderedWorkoutBlock[] =>
  normalizedBlockOrder(workout).reduce<OrderedWorkoutBlock[]>((blocks, block) => {
    if (block.type === "exercise") {
      const exercise = workout.exercises.find((item) => item.id === block.id);
      if (exercise) blocks.push({ type: "exercise", exercise });
    } else {
      const activity = workout.cardio.find((item) => item.id === block.id);
      if (activity) blocks.push({ type: "activity", activity });
    }
    return blocks;
  }, []);

export function AppMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="app-mark flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-[14px] bg-[var(--lime)] text-[#11140d] shadow-[0_0_24px_rgba(198,255,74,.18)]">
        <Dumbbell className="size-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <div className="app-mark-copy min-w-0">
          <p className="text-[1.05rem] font-black tracking-[-0.04em] text-white">Coach Loop</p>
          <p className="text-xs font-medium text-white/42">Local training log · {APP_RELEASE}</p>
        </div>
      )}
    </div>
  );
}

export const navItems: { value: MainView; label: string; icon: typeof Activity }[] = [
  { value: "today", label: "Today", icon: Activity },
  { value: "history", label: "History", icon: History },
  { value: "coach", label: "Coach", icon: Bot },
  { value: "progress", label: "Progress", icon: BarChart3 },
  { value: "settings", label: "Settings", icon: Settings },
];

export function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat-tile">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/38">{label}</p>
      <p className="mt-2 text-[1.75rem] font-black tracking-[-0.06em] text-white">{value}</p>
      <p className="mt-1 text-sm text-white/46">{detail}</p>
    </div>
  );
}

export function EmptyPanel({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof Activity;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-panel">
      <span className="grid size-12 place-items-center rounded-2xl border border-white/8 bg-white/[0.035] text-[var(--lime)]">
        <Icon className="size-5" />
      </span>
      <div>
        <h3 className="font-extrabold tracking-[-0.025em] text-white">{title}</h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-white/48">{text}</p>
      </div>
      {action}
    </div>
  );
}

export const syncCopy: Record<SyncStatus, string> = {
  connecting: "Connecting…",
  saving: "Saving…",
  synced: "Synced across devices",
  offline: "Offline · saved here",
  error: "Sync needs attention",
};
