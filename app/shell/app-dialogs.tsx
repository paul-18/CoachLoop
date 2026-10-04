import { HyroxSetup } from "../views/hyrox-ui";
import { ImportWorkoutDialog, SkipWorkoutDialog, CoachDialog } from "../views/today-view";
import type { ShellModel } from "./use-shell-model";

export function AppDialogs({ model }: { model: ShellModel }) {
  const { state, displayedState, applyProjectedUpdate } = model.persistence;
  const { hyroxOpen, setHyroxOpen, startWorkout, savePlannedWorkout, activeWorkout, importOpen, setImportOpen, importDraft, setImportDraft, skipWorkout, setSkipWorkoutId, skipPlannedWorkout, coachOpen, setCoachOpen } = model.workouts;
  return <>
      <HyroxSetup open={hyroxOpen} onOpenChange={setHyroxOpen} onStart={startWorkout} onSave={savePlannedWorkout} active={Boolean(activeWorkout)} unit={state.settings.defaultUnit} />
      <ImportWorkoutDialog open={importOpen} onOpenChange={setImportOpen} text={importDraft} onTextChange={setImportDraft} state={displayedState} onStart={startWorkout} onSave={savePlannedWorkout} />
      <SkipWorkoutDialog workout={skipWorkout} open={Boolean(skipWorkout)} onOpenChange={(open) => { if (!open) setSkipWorkoutId(null); }} onSkip={skipPlannedWorkout} />
      <CoachDialog open={coachOpen} onOpenChange={setCoachOpen} state={displayedState} onRemember={(coachCheckIn) => applyProjectedUpdate((current) => ({ ...current, settings: { ...current.settings, coachCheckIn }, settingsUpdatedAt: new Date().toISOString() }))} onMarkSent={() => applyProjectedUpdate((current) => ({ ...current, settings: { ...current.settings, lastCoachBriefAt: new Date().toISOString() }, settingsUpdatedAt: new Date().toISOString() }))} />
  </>;
}
