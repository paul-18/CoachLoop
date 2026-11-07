import { SaveErrorBanner } from "../views/save-error-banner";
import { HyroxWorkout } from "../views/hyrox-ui";
import { WorkoutEditor } from "../views/workout-editor";
import { ViewErrorBoundary } from "./view-error-boundary";
import type { ShellModel } from "./use-shell-model";

export function WorkoutScreen({ model }: { model: ShellModel }) {
  const { displayedState, localSaveStatus, setLocalSaveRetry, committing, demoActive } = model.persistence;
  const { displayedWorkout, editingWorkoutId, quickLogActivityId, putWorkout, finishEditor, discardWorkout, leaveEditor } = model.workouts;
  if (!displayedWorkout) return null;
  return <>
    {localSaveStatus === "error" && <SaveErrorBanner onRetry={() => setLocalSaveRetry(value => value + 1)} />}
    <div inert={committing} aria-busy={committing}>
    <ViewErrorBoundary onReload={model.restart} label="This workout" resetKey={displayedWorkout.id}>
      {displayedWorkout.hyrox
        ? <HyroxWorkout saveStatus={localSaveStatus} history={displayedState.workouts} key={displayedWorkout.id} workout={displayedWorkout} unit={displayedState.settings.defaultUnit} onUpdate={putWorkout} onFinish={finishEditor} onDiscard={discardWorkout} onBack={leaveEditor} />
        : <WorkoutEditor demoMode={demoActive} quickLogActivityId={quickLogActivityId} saveStatus={localSaveStatus} workout={displayedWorkout} state={displayedState} onIncrement={model.progress.updateLoadIncrement} onUpdate={putWorkout} onSaveTemplate={model.workouts.saveAsTemplate} onFinish={(workout) => finishEditor(workout)} onDiscard={editingWorkoutId ? undefined : discardWorkout} onBack={leaveEditor} />}
    </ViewErrorBoundary>
    </div>
  </>;
}
