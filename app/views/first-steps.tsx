import { useState } from "react";
import type { GoalTarget, TrainingState } from "../domain/training-types";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";
import { WORKOUT_TEMPLATES, makeGoalTarget, presetById, presetsForFocus, stampNewTarget, templateById, type SetupFocus } from "../domain/setup-content";

export const sampleWorkout = () => templateById("full")!.fitlog();

export function FirstSteps({ state, view, onFinish, onTemplate }: {
  state: TrainingState;
  view: MainView;
  onFinish: (targets: GoalTarget[]) => void;
  onTemplate: (fitlog: string, targets: GoalTarget[]) => void;
}) {
  const [screen, setScreen] = useState(0);
  const [focus, setFocus] = useState<SetupFocus>("both");
  const [picked, setPicked] = useState<string[]>([]);
  if (state.settings.setupComplete || state.workouts.some(workout => workout.status === "completed")) return null;
  if (view !== "today") return null;
  const presets = presetsForFocus(focus);
  const toggle = (id: string) => setPicked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const targets = (): GoalTarget[] => picked.flatMap(id => {
    const preset = presetById(id);
    return preset ? [stampNewTarget(state, makeGoalTarget(preset))] : [];
  });
  return <section className="first-steps setup-flow" aria-label="Quick setup">
    <div className="setup-top"><strong>Quick setup</strong><span>{screen + 1} of 3</span></div>
    {screen === 0 && <>
      <h2>What are you training?</h2>
      <p>30 seconds. Tap one. No typing.</p>
      <div className="setup-choices">{([
        ["strength", "Strength"],
        ["run", "Running"],
        ["both", "Both"],
        ["log", "Just logging"],
      ] as const).map(([id, label]) => <button type="button" key={id} className={focus === id ? "is-selected" : ""} onClick={() => setFocus(id)}>{label}</button>)}</div>
      <div className="setup-actions"><Button variant="ghost" onClick={() => onFinish([])}>Skip</Button><Button onClick={() => setScreen(1)}>Continue</Button></div>
    </>}
    {screen === 1 && <>
      <h2>Pick a target</h2>
      <p>Optional. These stay drafts until you continue. Existing goals are kept.</p>
      <div className="setup-choices">{presets.map(preset => <button type="button" key={preset.id} className={picked.includes(preset.id) ? "is-selected" : ""} onClick={() => toggle(preset.id)}>{preset.label}</button>)}
        {!presets.length && <p>No target needed for logging only.</p>}</div>
      <div className="setup-actions"><Button variant="ghost" onClick={() => onFinish(targets())}>Skip</Button><Button onClick={() => setScreen(2)}>Continue</Button></div>
    </>}
    {screen === 2 && <>
      <h2>Start from a template</h2>
      <p>One tap opens it for review. It is not saved until you confirm.</p>
      <div className="setup-choices">{WORKOUT_TEMPLATES.map(template => <button type="button" key={template.id} onClick={() => onTemplate(template.fitlog(), targets())}><strong>{template.label}</strong><small>{template.detail}</small></button>)}</div>
      <div className="setup-actions"><Button variant="ghost" onClick={() => onFinish(targets())}>Skip for now</Button></div>
    </>}
  </section>;
}

