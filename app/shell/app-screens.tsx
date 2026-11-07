import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppMark, navItems, type MainView } from "../views/shared";
import { TodayView } from "../views/today-view";
import { HistoryView } from "../views/history-view";
import { CoachView } from "../views/coach-view";
import { ProgressView } from "../views/progress-view";
import { SettingsView } from "../views/settings-view";
import { FirstSteps } from "../views/first-steps";
import { DemoBar } from "../views/demo-bar";
import { SampleWorkoutPreview } from "../views/sample-workout";
import { addSamplePlan, blankStartState, dismissCoachingPrompt, exampleSetupState, removeStarterState, undoBlankStart } from "../views/starter-plan";
import { ViewErrorBoundary } from "./view-error-boundary";
import { WorkoutScreen } from "./workout-screen";
import type { ShellModel } from "./use-shell-model";

/** Eager screens retain offline navigation and the established tab/DOM layout. */
export function AppScreens({ model }: { model: ShellModel }) {
  const { persistence, navigation, workouts, progress, offline, restart, onApplyUpdate } = model;
  const { state, displayedState, applyProjectedUpdate, resolveConflict, restoreBackup, resetAll, busy, syncStatus, syncFailure, retrySync, lastSyncedAt, localSaveStatus, setLocalSaveRetry, demoActive, enterDemo, exitDemo } = persistence;
  const { view, setView, navigateTab, returnTabToTop, openSettingsSection, calendarRequest, setCalendarRequest, consumeCalendarRequest, bodyweightPromptOpen, setBodyweightPromptOpen, settingsSection, consumeSettingsSection } = navigation;
  const { lastImportId, setLastImportId, deleteWorkout, setCoachOpen, setImportOpen, activeChoices, resumeWorkout, setWorkoutOpen, workoutOpen, activeWorkout, setHyroxOpen, startBlank, quickCardio, startPlannedWorkout, saveAsTemplate, reschedulePlan, setSkipWorkoutId, editWorkout, repeatWorkout, replanWorkout } = workouts;
  const [sampleOpen, setSampleOpen] = useState(false);
  const leaveDemo = () => { exitDemo(); setWorkoutOpen(false); setSampleOpen(false); };
  const dismissFirstNote = () => applyProjectedUpdate(current => ({ ...current, settings: { ...current.settings, firstWorkoutNote: "dismissed" as const }, settingsUpdatedAt: new Date().toISOString() }));
  const { offlineReady, updateReady, release, checkUpdates } = offline;
  const { logBodyweight, updateSettings, changeActivityType, saveWaist } = progress;
  const handleTabChange = (targetView: MainView) => {
    if (workoutOpen) setWorkoutOpen(false);
    navigateTab(targetView);
  };
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const syncKeyboardState = () => {
      const vv = window.visualViewport;
      const focusedField = Boolean(document.activeElement?.matches("input, textarea, select, [contenteditable='true']"));
      const keyboardUp = Boolean(focusedField && vv && window.innerHeight > 0 && vv.height < window.innerHeight * 0.76);
      if (keyboardUp) document.documentElement.dataset.keyboardOpen = "true";
      else delete document.documentElement.dataset.keyboardOpen;
    };
    const reanchorFixedChrome = () => {
      syncKeyboardState();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        const nodes = document.querySelectorAll<HTMLElement>(".mobile-nav, .workout-header, .rest-timer, .hyrox-controls");
        nodes.forEach((node) => {
          node.style.transform = "translate3d(0, 0.5px, 0)";
          void node.offsetHeight;
        });
        raf2 = requestAnimationFrame(() => {
          nodes.forEach((node) => {
            node.style.removeProperty("transform");
          });
        });
      });
    };
    const onFocusIn = () => {
      syncKeyboardState();
      clearTimeout(timer);
      timer = setTimeout(reanchorFixedChrome, 150);
    };
    const onFocusOut = () => {
      delete document.documentElement.dataset.keyboardOpen;
      reanchorFixedChrome();
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.scrollBy(0, 0);
        reanchorFixedChrome();
      }, 120);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") reanchorFixedChrome();
    };
    reanchorFixedChrome();
    window.addEventListener("pageshow", reanchorFixedChrome);
    window.addEventListener("focus", reanchorFixedChrome);
    window.addEventListener("orientationchange", reanchorFixedChrome);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", reanchorFixedChrome);
    vv?.addEventListener("scroll", reanchorFixedChrome);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
      delete document.documentElement.dataset.keyboardOpen;
      window.removeEventListener("pageshow", reanchorFixedChrome);
      window.removeEventListener("focus", reanchorFixedChrome);
      window.removeEventListener("orientationchange", reanchorFixedChrome);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", reanchorFixedChrome);
      vv?.removeEventListener("scroll", reanchorFixedChrome);
    };
  }, [workoutOpen, view]);
  return (
      <Tabs value={view} onValueChange={(value) => handleTabChange(value as MainView)} className="min-h-dvh bg-[#10120f] text-white">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <aside className="desktop-rail">
          <div className="rail-brand"><AppMark /></div>
          <nav aria-label="Primary">
            <TabsList className="rail-nav h-auto w-full flex-col gap-1 bg-transparent p-0">
              {navItems.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} id={`desktop-tab-${value}`} aria-controls={`panel-${value}`} value={value} onClick={() => { if (workoutOpen) setWorkoutOpen(false); returnTabToTop(value); }} className="rail-tab"><Icon />{label}</TabsTrigger>)}
            </TabsList>
          </nav>
        </aside>

        <main id="main-content" tabIndex={-1} className="app-main">
          {demoActive && <DemoBar onExit={leaveDemo} />}
          {lastImportId && displayedState.workouts.some(w => w.id === lastImportId && w.status === "planned" && !w.exercises.some(e => e.sets.some(set => set.completed)) && !w.cardio.some(c => c.completed || c.efforts?.some(e => e.completed))) && <div className="reliability-bar"><span>Last imported plan</span><Button size="sm" variant="outline" disabled={demoActive} onClick={() => { deleteWorkout(lastImportId); setLastImportId(null); toast("Unstarted import undone"); }}>Undo import</Button></div>}


          {!sampleOpen && !workoutOpen && !displayedState.activeWorkoutId && <FirstSteps state={displayedState} view={view} onStarter={() => applyProjectedUpdate(exampleSetupState)} onBlank={() => applyProjectedUpdate(blankStartState)} onRestore={() => openSettingsSection("backup")} onDemo={enterDemo} onSample={() => { setView("today"); setSampleOpen(true); }} />}
          
          {(activeChoices.length > 1 || (activeChoices.length > 0 && !displayedState.activeWorkoutId)) && <div role="status" className="m-3 rounded-xl border border-amber-300/25 p-3 text-sm"><p className="font-bold">Choose the workout to resume</p><div className="mt-2 flex flex-wrap gap-2">{activeChoices.map((choice) => <Button key={choice.id} size="sm" variant="outline" onClick={() => { resumeWorkout(choice.id); }}>{choice.name} · {choice.date}</Button>)}</div></div>}
          {localSaveStatus === "error" && <div role="alert" className="m-3 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm">Latest changes are not saved on this device. <Button size="sm" onClick={() => setLocalSaveRetry((value) => value + 1)}>Retry save</Button></div>}
          <TabsContent id="panel-today" aria-labelledby="mobile-tab-today desktop-tab-today" value="today"><ViewErrorBoundary onReload={restart} label="Today" resetKey={view}>{sampleOpen ? <SampleWorkoutPreview unit={displayedState.settings.defaultUnit} onClose={() => setSampleOpen(false)} onAdd={demoActive ? undefined : () => { applyProjectedUpdate(addSamplePlan); setSampleOpen(false); }} /> : workoutOpen && workouts.displayedWorkout ? <WorkoutScreen model={model} /> : <TodayView existingWorkoutRequest={navigation.existingWorkoutRequest} onExistingWorkoutOpened={navigation.consumeExistingWorkoutRequest} state={displayedState} onHyrox={() => setHyroxOpen(true)} onStartBlank={startBlank} onQuickCardio={quickCardio} onImport={() => setImportOpen(true)} onCoach={() => setCoachOpen(true)} onResume={() => setWorkoutOpen(true)} onStartPlan={startPlannedWorkout} onSaveTemplate={saveAsTemplate} onDeleteTemplate={deleteWorkout} onReschedulePlan={reschedulePlan} onSkipPlan={setSkipWorkoutId} onHistory={() => setView("history")} onTrainingCalendar={() => { setCalendarRequest((value) => value + 1); setView("progress"); }} onBodyweightLog={() => { setBodyweightPromptOpen(true); setView("progress"); }} onEditGoals={() => openSettingsSection("training-goals")} onRemoveStarter={() => applyProjectedUpdate(removeStarterState)} onUndoBlank={() => applyProjectedUpdate(undoBlankStart)} onDismissCoachingPrompt={() => applyProjectedUpdate(dismissCoachingPrompt)} onOpenCoachingPreferences={() => openSettingsSection("coach-profile")} onDismissFirstNote={dismissFirstNote} syncStatus={syncStatus} updateReady={updateReady} onOpenUpdate={() => setView("settings")} />}</ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-history" aria-labelledby="mobile-tab-history desktop-tab-history" value="history"><ViewErrorBoundary onReload={restart} label="History" resetKey={view}><HistoryView existingWorkoutRequest={navigation.existingWorkoutRequest} onExistingWorkoutOpened={navigation.consumeExistingWorkoutRequest} state={displayedState} demoActive={demoActive} onDismissFirstNote={dismissFirstNote} onEdit={editWorkout} onRepeat={repeatWorkout} onReplan={replanWorkout} onSaveTemplate={saveAsTemplate} onDelete={deleteWorkout} /></ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-coach" aria-labelledby="mobile-tab-coach desktop-tab-coach" value="coach"><ViewErrorBoundary onReload={restart} label="Coach" resetKey={view}><CoachView state={displayedState} onEditGoals={() => openSettingsSection("training-goals")} onEditProfile={() => openSettingsSection("coach-profile")} onBuild={() => setCoachOpen(true)} onImport={() => setImportOpen(true)} /></ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-progress" aria-labelledby="mobile-tab-progress desktop-tab-progress" value="progress"><ViewErrorBoundary onReload={restart} label="Progress" resetKey={view}><ProgressView onUpdateSettings={updateSettings} state={displayedState} calendarRequest={calendarRequest} onCalendarOpened={consumeCalendarRequest} onChangeActivityType={changeActivityType} onLogBodyweight={logBodyweight} bodyweightPromptOpen={bodyweightPromptOpen} onBodyweightPromptChange={setBodyweightPromptOpen} onSaveWaist={saveWaist} /></ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-settings" aria-labelledby="mobile-tab-settings desktop-tab-settings" value="settings"><ViewErrorBoundary onReload={restart} label="Settings" resetKey={view}><SettingsView openSection={settingsSection} onSectionOpened={consumeSettingsSection} state={displayedState} canonicalState={state} demoActive={demoActive} onEnterDemo={enterDemo} setState={applyProjectedUpdate} onResolveConflict={resolveConflict} onRestoreBackup={restoreBackup} onReset={resetAll} syncStatus={syncStatus} syncFailure={syncFailure} onRetrySync={retrySync} lastSyncedAt={lastSyncedAt} offlineReady={offlineReady} updateReady={updateReady} updateStatus={offline.updateStatus} release={release} localSaveStatus={localSaveStatus} updateBlocked={demoActive || busy || !!activeWorkout || workoutOpen || localSaveStatus !== "saved"} onCheckUpdates={demoActive ? undefined : checkUpdates} onApplyUpdate={onApplyUpdate} /></ViewErrorBoundary></TabsContent>
        </main>

        <TabsList className="mobile-nav" aria-label="Primary">
          {navItems.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} id={`mobile-tab-${value}`} aria-controls={`panel-${value}`} value={value} onClick={() => { if (workoutOpen) setWorkoutOpen(false); returnTabToTop(value); }} className="mobile-tab"><Icon /><span>{label}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
  );
}
