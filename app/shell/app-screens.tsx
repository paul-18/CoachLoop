import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppMark, navItems, type MainView } from "../views/shared";
import { TodayView } from "../views/today-view";
import { HistoryView } from "../views/history-view";
import { CoachView } from "../views/coach-view";
import { ProgressView } from "../views/progress-view";
import { SettingsView } from "../views/settings-view";
import { FirstSteps, sampleWorkout } from "../views/first-steps";
import { ViewErrorBoundary } from "./view-error-boundary";
import type { ShellModel } from "./use-shell-model";

/** Eager screens retain offline navigation and the established tab/DOM layout. */
export function AppScreens({ model }: { model: ShellModel }) {
  const { persistence, navigation, workouts, progress, offline, restart, onApplyUpdate } = model;
  const { state, displayedState, applyProjectedUpdate, resolveConflict, restoreBackup, resetAll, busy, syncStatus, syncFailure, retrySync, lastSyncedAt, localSaveStatus, setLocalSaveRetry } = persistence;
  const { view, setView, navigateTab, returnTabToTop, openSettingsSection, calendarRequest, setCalendarRequest, consumeCalendarRequest, bodyweightPromptOpen, setBodyweightPromptOpen, settingsSection, consumeSettingsSection } = navigation;
  const { lastImportId, setLastImportId, deleteWorkout, setCoachOpen, setImportOpen, setImportDraft, activeChoices, resumeWorkout, setWorkoutOpen, workoutOpen, activeWorkout, setHyroxOpen, startBlank, quickCardio, startPlannedWorkout, reschedulePlan, setSkipWorkoutId, editWorkout, repeatWorkout, replanWorkout } = workouts;
  const { offlineReady, updateReady, release, checkUpdates } = offline;
  const { logBodyweight, updateSettings, changeActivityType, saveWaist } = progress;
  return (
      <Tabs value={view} onValueChange={(value) => navigateTab(value as MainView)} className="min-h-dvh bg-[#10120f] text-white">
        <aside className="desktop-rail">
          <div className="rail-brand"><AppMark /></div>
          <TabsList className="rail-nav h-auto w-full flex-col gap-1 bg-transparent p-0">
            {navItems.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} id={`desktop-tab-${value}`} aria-controls={`panel-${value}`} value={value} onClick={() => returnTabToTop(value)} className="rail-tab"><Icon />{label}</TabsTrigger>)}
          </TabsList>
        </aside>

        <div className="app-main">
          {lastImportId && state.workouts.some(w => w.id === lastImportId && w.status === "planned" && !w.exercises.some(e => e.sets.some(set => set.completed)) && !w.cardio.some(c => c.completed || c.efforts?.some(e => e.completed))) && <div className="reliability-bar"><span>Last imported plan</span><Button size="sm" variant="outline" onClick={() => { deleteWorkout(lastImportId); setLastImportId(null); toast("Unstarted import undone"); }}>Undo import</Button></div>}


          {!displayedState.activeWorkoutId && <FirstSteps state={displayedState} view={view} onSetup={openSettingsSection} onCoach={() => setCoachOpen(true)} onImport={() => setImportOpen(true)} onSample={() => { setImportDraft(sampleWorkout()); setImportOpen(true); }} />}
          
          {(activeChoices.length > 1 || (activeChoices.length > 0 && !state.activeWorkoutId)) && <div role="status" className="m-3 rounded-xl border border-amber-300/25 p-3 text-sm"><p className="font-bold">Choose the workout to resume</p><div className="mt-2 flex flex-wrap gap-2">{activeChoices.map((choice) => <Button key={choice.id} size="sm" variant="outline" onClick={() => { resumeWorkout(choice.id); }}>{choice.name} · {choice.date}</Button>)}</div></div>}
          {localSaveStatus === "error" && <div role="alert" className="m-3 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm">Latest changes are not saved on this device. <Button size="sm" onClick={() => setLocalSaveRetry((value) => value + 1)}>Retry save</Button></div>}
          <TabsContent id="panel-today" aria-labelledby="mobile-tab-today desktop-tab-today" value="today"><ViewErrorBoundary onReload={restart} label="Today" resetKey={view}><TodayView existingWorkoutRequest={navigation.existingWorkoutRequest} onExistingWorkoutOpened={navigation.consumeExistingWorkoutRequest} state={displayedState} onHyrox={() => setHyroxOpen(true)} onStartBlank={startBlank} onQuickCardio={quickCardio} onImport={() => setImportOpen(true)} onCoach={() => setCoachOpen(true)} onResume={() => setWorkoutOpen(true)} onStartPlan={startPlannedWorkout} onReschedulePlan={reschedulePlan} onSkipPlan={setSkipWorkoutId} onHistory={() => setView("history")} onTrainingCalendar={() => { setCalendarRequest((value) => value + 1); setView("progress"); }} onBodyweightLog={() => { setBodyweightPromptOpen(true); setView("progress"); }} syncStatus={syncStatus} /></ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-history" aria-labelledby="mobile-tab-history desktop-tab-history" value="history"><ViewErrorBoundary onReload={restart} label="History" resetKey={view}><HistoryView existingWorkoutRequest={navigation.existingWorkoutRequest} onExistingWorkoutOpened={navigation.consumeExistingWorkoutRequest} state={displayedState} onEdit={editWorkout} onRepeat={repeatWorkout} onReplan={replanWorkout} onDelete={deleteWorkout} /></ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-coach" aria-labelledby="mobile-tab-coach desktop-tab-coach" value="coach"><ViewErrorBoundary onReload={restart} label="Coach" resetKey={view}><CoachView state={state} onEditGoals={() => openSettingsSection("training-goals")} onBuild={() => setCoachOpen(true)} onImport={() => setImportOpen(true)} /></ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-progress" aria-labelledby="mobile-tab-progress desktop-tab-progress" value="progress"><ViewErrorBoundary onReload={restart} label="Progress" resetKey={view}><ProgressView onUpdateSettings={updateSettings} state={displayedState} calendarRequest={calendarRequest} onCalendarOpened={consumeCalendarRequest} onChangeActivityType={changeActivityType} onLogBodyweight={logBodyweight} bodyweightPromptOpen={bodyweightPromptOpen} onBodyweightPromptChange={setBodyweightPromptOpen} onSaveWaist={saveWaist} /></ViewErrorBoundary></TabsContent>
          <TabsContent id="panel-settings" aria-labelledby="mobile-tab-settings desktop-tab-settings" value="settings"><ViewErrorBoundary onReload={restart} label="Settings" resetKey={view}><SettingsView openSection={settingsSection} onSectionOpened={consumeSettingsSection} state={displayedState} canonicalState={state} setState={applyProjectedUpdate} onResolveConflict={resolveConflict} onRestoreBackup={restoreBackup} onReset={resetAll} syncStatus={syncStatus} syncFailure={syncFailure} onRetrySync={retrySync} lastSyncedAt={lastSyncedAt} offlineReady={offlineReady} updateReady={updateReady} updateStatus={offline.updateStatus} release={release} localSaveStatus={localSaveStatus} updateBlocked={busy || !!activeWorkout || workoutOpen || localSaveStatus !== "saved"} onCheckUpdates={checkUpdates} onApplyUpdate={onApplyUpdate} /></ViewErrorBoundary></TabsContent>
        </div>

        <TabsList className="mobile-nav">
          {navItems.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} id={`mobile-tab-${value}`} aria-controls={`panel-${value}`} value={value} onClick={() => returnTabToTop(value)} className="mobile-tab"><Icon /><span>{label}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
  );
}
