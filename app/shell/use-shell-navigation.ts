import { useCallback, useEffect, useState } from "react";
import type { MainView } from "../views/shared";

const VALID_VIEWS = new Set<MainView>(["today", "history", "coach", "progress", "settings"]);

function initialViewFromLocation(): MainView {
  if (typeof window === "undefined") return "today";
  try {
    const param = new URLSearchParams(window.location.search).get("view") as MainView | null;
    if (param && VALID_VIEWS.has(param)) return param;
  } catch { /* Default to today if URL parsing fails. */ }
  return "today";
}

export function useShellNavigation() {
  const [existingWorkoutRequest, setExistingWorkoutRequest] = useState<string | null>(null);
  const consumeExistingWorkoutRequest = useCallback(() => setExistingWorkoutRequest(null), []);
  const [view, setView] = useState<MainView>(initialViewFromLocation);
  const [bodyweightPromptOpen, setBodyweightPromptOpen] = useState(false);
  const [calendarRequest, setCalendarRequest] = useState(0);
  const [settingsSection, setSettingsSection] = useState<"coach-profile" | "training-goals" | "backup" | null>(null);
  const consumeSettingsSection = useCallback(() => setSettingsSection(null), []);
  const openSettingsSection = (section: "coach-profile" | "training-goals" | "backup") => { setSettingsSection(section); setView("settings"); };
  const consumeCalendarRequest = useCallback(() => setCalendarRequest(0), []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  const navigateTab = (value: MainView) => { setCalendarRequest(0); setView(value); };
  const returnTabToTop = (value: MainView) => {
    if (value !== view) return;
    setCalendarRequest(0);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return { existingWorkoutRequest, setExistingWorkoutRequest, consumeExistingWorkoutRequest, view, setView, bodyweightPromptOpen, setBodyweightPromptOpen, calendarRequest, setCalendarRequest, settingsSection, consumeSettingsSection, openSettingsSection, consumeCalendarRequest, navigateTab, returnTabToTop };
}
