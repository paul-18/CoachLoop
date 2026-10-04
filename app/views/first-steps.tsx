import type { TrainingState } from "../domain/training-types";
import { localDate } from "../domain/training-types";
import { Button } from "@/components/ui/button";
import type { MainView } from "./shared";

export const sampleWorkout = () => `[FITLOG:1]
WORKOUT|Example workout — review before saving|${localDate()}
EXERCISE|Bodyweight squat
SET|8|Bodyweight|RPE 5
REST|60
CARDIO|Easy walk
TYPE|walk
DURATION|10
INTENSITY|easy
NOTES|Format example only. Choose movements and effort suitable for you.
[/FITLOG]`;

export function FirstSteps({ state, view, onSetup, onCoach, onSample, onImport }: {
  state: TrainingState;
  view: MainView;
  onSetup: (section: "coach-profile" | "training-goals") => void;
  onCoach: () => void;
  onSample: () => void;
  onImport?: () => void;
}) {
  if (state.workouts.some(workout => workout.status === "completed")) return null;
  const profileReady = Boolean(state.coachProfile.trim());
  const goalsReady = state.goals.some(goal => goal.trim());
  const heading = view === "history" ? "Your history starts with your first session" : view === "progress" ? "Your progress starts with logged results" : "Start your coaching loop";
  return <details className="first-steps" open={view !== "settings" && (view !== "today" || !profileReady || !goalsReady)}>
    <summary><span>{heading}</span><span aria-hidden="true">⌄</span></summary>
    <p>{view === "progress" ? "Completed sets build charts and strength comparisons. A missing result means there is no data yet." : view === "history" ? "Imported plans stay on Today. Complete a workout to see what you actually did here." : "No history needed. Set your direction, ask your AI, then log what you do."}</p>
    <ol>
      <li><span className="step-number">1</span><div><strong>Describe your background{profileReady ? " · Added" : ""}</strong><small>Tell your AI your experience, available days, equipment, limitations and long-term direction. This stays editable.</small></div><Button variant="outline" onClick={() => onSetup("coach-profile")}>{profileReady ? "Edit profile" : "Set profile"}</Button></li>
      <li><span className="step-number">2</span><div><strong>Rank your training goals{goalsReady ? " · Added" : ""}</strong><small>Put your most important goal first. Start from an optional example in Settings, then make it your own.</small></div><Button variant="outline" onClick={() => onSetup("training-goals")}>{goalsReady ? "Edit goals" : "Add goals"}</Button></li>
      <li><span className="step-number">3</span><div><strong>Ask your preferred AI</strong><small>Choose Start a new chat, copy the brief, and paste it into your AI outside this app.</small></div><Button onClick={onCoach}>Build brief</Button></li>
      <li><span className="step-number">4</span><div><strong>Bring back your workout</strong><small>Ask the AI for one FITLOG block. Copy everything from [FITLOG:1] to [/FITLOG], paste it here, and review before starting or saving a plan for later.</small></div>{onImport && <Button variant="outline" onClick={onImport}>Paste workout</Button>}</li>
      <li><span className="step-number">5</span><div><strong>Log results, then finish</strong><small>Planned numbers are targets. Enter what you actually did, mark sets complete, then use Done → Finish workout. History and Progress use logged results.</small></div></li>
    </ol>
    <div className="first-steps-footer"><p>Bring back one FITLOG block, review it, and start or save the plan.</p><Button variant="outline" onClick={onSample}>Try example import</Button></div>
    <small className="first-steps-note">The example opens for review. It adds no workout or history unless you choose to start or save it.</small>
    <p>Prefer to train without AI? Use Blank workout or an activity shortcut on Today.</p>
    <p>On iPhone, add this app using Safari’s Share → Add to Home Screen. Your log stays in this browser; it does not sync. In Settings, use Share backup / Save to Files to keep a separate recovery copy.</p>
    <small className="first-steps-note">For your next AI conversation, build a fresh brief with your recent results. This starter guide disappears after your first completed workout.</small>
  </details>;
}
