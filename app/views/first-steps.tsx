import type { TrainingState } from "../domain/training-types";
import { DEFAULT_COACH_PROFILE } from "../interchange/coach-export";
import { exampleFitlog } from "../interchange/fitlog";
import { STARTER_GOALS } from "./goal-examples";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";

export const sampleWorkout = exampleFitlog;

export function FirstSteps({ state, view, onSetup, onCoach, onSample, onAcceptGoals, onAcceptProfile }: {
  state: TrainingState;
  view: MainView;
  onSetup: (section: "coach-profile" | "training-goals") => void;
  onCoach: () => void;
  onSample: () => void;
  onImport?: () => void;
  onAcceptGoals?: () => void;
  onAcceptProfile?: () => void;
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
    <h2>Two goals and a coach profile</h2>
    <ol className="first-steps-goals">{STARTER_GOALS.map(goal => <li key={goal}>{goal}</li>)}</ol>
    <p className="first-steps-profile">{DEFAULT_COACH_PROFILE}</p>
    <div className="first-steps-actions">
      {!goalsReady && <Button onClick={() => onAcceptGoals?.()}>Use these goals</Button>}
      {!profileReady && <Button variant="outline" onClick={() => onAcceptProfile?.()}>Use this profile</Button>}
      <Button variant="outline" onClick={() => onSetup("training-goals")}>{goalsReady ? "Edit goals" : "Add goals"}</Button>
      {profileReady && <Button variant="outline" onClick={() => onSetup("coach-profile")}>Edit coach profile</Button>}
      {readyForAi && <Button variant="outline" onClick={onCoach}>Ask your AI</Button>}
      <Button variant="outline" onClick={onSample}>See an example workout</Button>
    </div>
    {!readyForAi && <p className="first-steps-wait">Ask your AI stays off until both are saved.</p>}
    <details className="first-steps-how">
      <summary>How this works</summary>
      <ol>
        <li><span className="step-number">1</span><div><strong>Keep the two goals{goalsReady ? " · Added" : ""}</strong><small>Bench press 225 lb, then a 5k under 30 minutes.</small></div></li>
        <li><span className="step-number">2</span><div><strong>Keep the coach profile{profileReady ? " · Added" : ""}</strong><small>It already describes a bench-and-5k week. Edit it later if you want.</small></div></li>
        <li><span className="step-number">3</span><div><strong>Open the example as a list</strong><small>Five easy minutes on the bike, a bench warm-up plus four heavier sets, bodyweight pull-ups and dips, light lateral raises, then mobility. The raw text stays hidden the first time. Nothing is saved until you start or save it.</small></div></li>
      </ol>
      <p>On iPhone, add this app from Safari’s Share → Add to Home Screen. The log stays on this phone. In Settings, use Share backup to keep a copy in Files.</p>
      <small className="first-steps-note">This note goes away after your first completed workout.</small>
    </details>
  </section>;
}