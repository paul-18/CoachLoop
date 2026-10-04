import { Toaster } from "@/components/ui/sonner";
import { SaveErrorBanner } from "../views/save-error-banner";
import { HyroxWorkout } from "../views/hyrox-ui";
import { WorkoutEditor } from "../views/workout-editor";
import { ViewErrorBoundary } from "./view-error-boundary";
import type { ShellModel } from "./use-shell-model";

export function WorkoutScreen({ model }: { model: ShellModel }) {
  const { displayedState, localSaveStatus, setLocalSaveRetry } = model.persistence;
  const { displayedWorkout, editingWorkoutId, putWorkout, finishEditor, discardWorkout, leaveEditor } = model.workouts;
  if (!displayedWorkout) return null;
  return <>
    {localSaveStatus === "error" && <SaveErrorBanner onRetry={() => setLocalSaveRetry(value => value + 1)} />}
    <ViewErrorBoundary onReload={model.restart} label="This workout" resetKey={displayedWorkout.id}>
      {displayedWorkout.hyrox
        ? <HyroxWorkout history={displayedState.workouts} key={displayedWorkout.id} workout={displayedWorkout} unit={displayedState.settings.defaultUnit} onUpdate={putWorkout} onFinish={finishEditor} onDiscard={discardWorkout} onBack={leaveEditor} />
        : <WorkoutEditor workout={displayedWorkout} state={displayedState} onIncrement={model.progress.updateLoadIncrement} onUpdate={putWorkout} onFinish={() => finishEditor()} onDiscard={editingWorkoutId ? undefined : discardWorkout} onBack={leaveEditor} />}
    </ViewErrorBoundary>
    <Toaster position="top-center" />
  </>;
}
