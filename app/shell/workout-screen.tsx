import { Toaster } from "@/components/ui/sonner";
import { SaveErrorBanner } from "../views/save-error-banner";
import { HyroxWorkout } from "../views/hyrox-ui";
import { WorkoutEditor } from "../views/workout-editor";
import { ViewErrorBoundary } from "./view-error-boundary";
import type { ShellModel } from "./use-shell-model";

export function WorkoutScreen({ model }: { model: ShellModel }) {
  const { displayedState, localSaveStatus, setLocalSaveRetry, committing } = model.persistence;
  const { displayedWorkout, editingWorkoutId, putWorkout, finishEditor, discardWorkout, leaveEditor } = model.workouts;
  if (!displayedWorkout) return null;
  return <>
    {localSaveStatus === "error" && <SaveErrorBanner onRetry={() => setLocalSaveRetry(value => value + 1)} />}
    <div inert={committing} aria-busy={committing}>
    <ViewErrorBoundary onReload={model.restart} label="This workout" resetKey={displayedWorkout.id}>
      {displayedWorkout.hyrox
        ? <HyroxWorkout saveStatus={localSaveStatus} history={displayedState.workouts} key={displayedWorkout.id} workout={displayedWorkout} unit={displayedState.settings.defaultUnit} onUpdate={putWorkout} onFinish={finishEditor} onDiscard={discardWorkout} onBack={leaveEditor} />
        : <WorkoutEditor saveStatus={localSaveStatus} workout={displayedWorkout} state={displayedState} onIncrement={model.progress.updateLoadIncrement} onUpdate={putWorkout} onFinish={() => finishEditor()} onDiscard={editingWorkoutId ? undefined : discardWorkout} onBack={leaveEditor} />}
    </ViewErrorBoundary>
    </div>
    <Toaster position="top-center" />
  </>;
}
