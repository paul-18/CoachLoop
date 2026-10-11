import type { TrainingState } from "../domain/training-types";
import { exampleFitlog } from "../interchange/fitlog";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";

export const sampleWorkout = exampleFitlog;

export function FirstSteps({ state, view, onSetup, onCoach, onSample }: {
  state: TrainingState;
  view: MainView;
  onSetup: (section: "coach-profile" | "training-goals") => void;
  onCoach: () => void;
  onSample: () => void;
  onImport?: () => void;
}) {
  if (view === "settings" || state.workouts.some(workout => workout.status === "completed")) return null;
  if (view !== "today") {
    const note = view === "history"
      ? "Completed workouts show up here. Start on Today."
      : view === "progress"
        ? "Charts use completed results. Start on Today."
        : "Add a goal and a coach profile on Today before you ask for a plan.";
    return <p className="first-steps-elsewhere">{note}</p>;
  }
  const profileReady = Boolean(state.coachProfile.trim());
  const goalsReady = state.goals.some(goal => goal.trim());
  const readyForAi = profileReady && goalsReady;
  return <section className="first-steps" aria-label="Start here">
    <p className="eyebrow">Start here</p>
    <h2>Goals and coach profile first</h2>
    <p>Save both before you ask an AI for a workout. The brief has nothing personal to use until then. Starter goals and starter guidance are only drafts — change them so they fit you.</p>
    <div className="first-steps-actions">
      <Button onClick={() => onSetup("training-goals")}>{goalsReady ? "Edit goals" : "Add goals"}</Button>
      <Button variant="outline" onClick={() => onSetup("coach-profile")}>{profileReady ? "Edit coach profile" : "Add coach profile"}</Button>
      {readyForAi && <Button variant="outline" onClick={onCoach}>Ask your AI</Button>}
      <Button variant="outline" onClick={onSample}>See an example workout</Button>
    </div>
    {!readyForAi && <p className="first-steps-wait">Ask your AI stays off until a goal and a coach profile are saved.</p>}
    <details className="first-steps-how">
      <summary>How this works</summary>
      <ol>
        <li><span className="step-number">1</span><div><strong>Goals{goalsReady ? " · Added" : ""}</strong><small>Start from an example such as bench 225 lb or a 5k under 30 minutes. Change it, then Save.</small></div></li>
        <li><span className="step-number">2</span><div><strong>Coach profile{profileReady ? " · Added" : ""}</strong><small>Starter guidance is filled in for you. Change it so it describes you before you save.</small></div></li>
        <li><span className="step-number">3</span><div><strong>Look at one example workout</strong><small>It is a 5-minute bike, a weighted bench, bodyweight pull-ups and dips, light lateral raises, then mobility. Nothing is saved until you start or save it. Paste a plan later, after this list makes sense.</small></div></li>
      </ol>
      <p>On iPhone, add this app from Safari’s Share → Add to Home Screen. The log stays on this phone. In Settings, use Share backup to keep a copy in Files.</p>
      <small className="first-steps-note">This note goes away after your first completed workout.</small>
    </details>
  </section>;
}