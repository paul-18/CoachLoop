/** Built-in AI coach context: the same training extract the Coach tab's "Build coach brief"
 * dialog copies, wrapped as a chat system prompt. The copy-prompt flow is untouched. */
import { buildCoachPrompt } from "../interchange/coach-export";
import { strengthRecords } from "../domain/training-metrics";
import { localDateDaysEarlier } from "../domain/training-insights";
import { localDate, type CoachOptions, type TrainingState } from "../domain/training-types";

/** Same options as the brief dialog's initial defaults (today-view.tsx `initialCoachOptions`).
 * Mode "new" mirrors the dialog's first-brief behavior: it embeds the saved coach profile as
 * durable background. The per-session check-in fields (energy, sleep, request, ...) stay empty:
 * an AI chat system prompt carries context, not a one-off brief. */
export const AI_SYSTEM_BRIEF_OPTIONS: CoachOptions = {
  mode: "new",
  days: 7,
  since: null,
  sinceAt: null,
  energy: "",
  sleep: "",
  soreness: "",
  timeAvailable: "",
  equipment: "",
  restrictions: "",
  schedule: "",
  request: "",
  emphasis: "",
};

const AI_SYSTEM_PREAMBLE = `You are a knowledgeable strength-training coach. Answer concisely and stay grounded in the training context below: it is read-only history, so never invent workouts the athlete did not log, and do not assume planned workouts were completed. If you are unsure about a detail, ask rather than guessing.`;

/** System prompt for the built-in AI coach: preamble plus the exact brief extract. */
export function buildAiSystemPrompt(state: TrainingState, today = localDate()): string {
  return `${AI_SYSTEM_PREAMBLE}\n\n${buildCoachPrompt(state, AI_SYSTEM_BRIEF_OPTIONS, today)}`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** One-line summary of what the AI context carries, with the prompt's character count. */
export function summarizeAiContext(
  state: TrainingState,
  today = localDate(),
): { oneLiner: string; charCount: number } {
  const cutoff = localDateDaysEarlier(13, today);
  const recentCompleted = state.workouts.filter(
    (workout) => workout.status === "completed" && workout.date <= today && workout.date >= cutoff,
  ).length;
  const recordCount = strengthRecords(state, state.settings.defaultUnit).size;
  const parts = [
    state.coachProfile.trim() ? "coaching profile" : "no coaching profile",
    plural(state.goals.length, "goal"),
    `last 14 days (${plural(recentCompleted, "completed workout")})`,
    plural(recordCount, "strength record"),
  ];
  const oneLiner = `Includes: ${parts.join(", ")}.`;
  return { oneLiner, charCount: buildAiSystemPrompt(state, today).length };
}
