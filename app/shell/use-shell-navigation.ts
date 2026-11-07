import { useCallback, useEffect, useState } from "react";
import type { MainView } from "../views/shared";

const VALID_VIEWS = new Set<MainView>(["today", "history", "coach", "progress", "settings"]);
const VIEW_TITLES: Record<MainView, string> = {
  today: "Today · Coach Loop",
  history: "History · Coach Loop",
  coach: "Coach · Coach Loop",
  progress: "Progress · Coach Loop",
  settings: "Settings · Coach Loop",
};

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
    if (typeof document !== "undefined") {
      document.title = VIEW_TITLES[view] ?? "Coach Loop";
    }
  }, [view]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => setView(initialViewFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigateTab = (value: MainView) => {
    setCalendarRequest(0);
    setView(value);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (value === "today") url.searchParams.delete("view");
        else url.searchParams.set("view", value);
        if (url.search !== window.location.search) {
          window.history.pushState({ view: value }, "", `${url.pathname}${url.search}${url.hash}`);
        }
      } catch { /* Ignore history state errors in restricted test contexts. */ }
    }
  };
  const returnTabToTop = (value: MainView) => {
    if (value !== view) return;
    setCalendarRequest(0);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return { existingWorkoutRequest, setExistingWorkoutRequest, consumeExistingWorkoutRequest, view, setView, bodyweightPromptOpen, setBodyweightPromptOpen, calendarRequest, setCalendarRequest, settingsSection, consumeSettingsSection, openSettingsSection, consumeCalendarRequest, navigateTab, returnTabToTop };
}
