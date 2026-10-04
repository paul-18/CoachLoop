import { useCallback, useEffect, useState } from "react";
import type { MainView } from "../views/shared";

export function useShellNavigation() {
  const [view, setView] = useState<MainView>("today");
  const [bodyweightPromptOpen, setBodyweightPromptOpen] = useState(false);
  const [calendarRequest, setCalendarRequest] = useState(0);
  const [settingsSection, setSettingsSection] = useState<"coach-profile" | "training-goals" | null>(null);
  const consumeSettingsSection = useCallback(() => setSettingsSection(null), []);
  const openSettingsSection = (section: "coach-profile" | "training-goals") => { setSettingsSection(section); setView("settings"); };
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
  return { view, setView, bodyweightPromptOpen, setBodyweightPromptOpen, calendarRequest, setCalendarRequest, settingsSection, consumeSettingsSection, openSettingsSection, consumeCalendarRequest, navigateTab, returnTabToTop };
}
