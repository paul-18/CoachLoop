import { Button } from "@/components/ui/button";
import type { GoalTarget, TrainingState } from "../domain/training-types";
import { GOAL_PRESETS, makeGoalTarget, stampNewTarget, targetProgress } from "../domain/setup-content";

export function TargetProgressLine({ state, target }: { state: TrainingState; target: GoalTarget }) {
  const progress = targetProgress(state, target);
  return <div className="goal-progress">
    <div className="goal-progress-track" aria-hidden="true"><span style={{ width: `${Math.round(progress.ratio * 100)}%` }} /></div>
    <small>{progress.done ? "Achieved" : progress.detail}</small>
  </div>;
}

/** Preset picker: creates structured, trackable goals. Drafts show live progress
 * from current training; tracking binds to the preset, so editing the label
 * later never breaks measurement. */
export function GoalExamples({ state, onAdd }: { state: TrainingState; onAdd: (target: GoalTarget) => void }) {
  const have = new Set((state.goalTargets ?? []).map(target => target.presetId));
  return <details className="rounded-xl border border-white/10 p-3">
    <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Concrete targets</summary>
    <p className="my-3 text-sm leading-6 text-white/55">Add a trackable target. Progress is measured from your logged training only.</p>
    <div className="space-y-3">{GOAL_PRESETS.map(preset => {
      const added = have.has(preset.id);
      return <div key={preset.id} className="rounded-xl bg-white/[0.025] p-3">
        <p className="mb-1 text-sm font-semibold">{preset.label}</p>
        <p className="mb-2 text-sm leading-6 text-white/70">{preset.text}</p>
        <TargetProgressLine state={state} target={makeGoalTarget(preset)} />
        <Button variant="outline" disabled={added} onClick={() => onAdd(stampNewTarget(state, makeGoalTarget(preset)))}>{added ? "Added" : `Track ${preset.label}`}</Button>
      </div>;
    })}</div>
  </details>;
}

/** Existing trackable goals with live progress and removal. */
export function GoalTargetList({ state, onRemove }: { state: TrainingState; onRemove: (id: string) => void }) {
  const targets = state.goalTargets ?? [];
  if (!targets.length) return null;
  return <div className="space-y-3">{targets.map(target => {
    const progress = targetProgress(state, target);
    return <div key={target.id} className="rounded-xl bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{target.label}</p>
        <Button variant="ghost" size="sm" onClick={() => onRemove(target.id)}>Remove</Button>
      </div>
      <TargetProgressLine state={state} target={target} />
      {progress.done && target.achievedAt && <small className="text-white/55">Achieved {new Date(target.achievedAt).toLocaleDateString()}</small>}
      {progress.done && !target.achievedAt && <small className="text-white/55">Achieved</small>}
    </div>;
  })}</div>;
}
