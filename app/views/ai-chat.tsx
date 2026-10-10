"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrainingState } from "../domain/training-types";
import { AiClientError, sendChatMessage, type AiChatMessage } from "../ai/ai-client";
import { buildAiSystemPrompt, summarizeAiContext } from "../ai/coach-context";
import { buildAiConfig } from "../ai/ai-settings-logic";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
}

/** In-app AI coach chat for the Coach tab. The system prompt is rebuilt fresh from
 * the current training state on every send and is never stored. Nothing is sent to
 * any provider unless the athlete taps send. */
export function AICoachChat({ state }: { state: TrainingState }) {
  const config = buildAiConfig(state.settings);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const attempt = async (base: UiMessage[]) => {
    if (!config || sending) return;
    setSending(true);
    setError("");
    try {
      const history: AiChatMessage[] = [
        { role: "system", content: buildAiSystemPrompt(state) },
        ...base.map((message): AiChatMessage => ({ role: message.role, content: message.content })),
      ];
      const { reply } = await sendChatMessage(config, history);
      setMessages([...base, { role: "assistant", content: reply }]);
    } catch (caught) {
      setError(caught instanceof AiClientError ? caught.message : caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setSending(false);
    }
  };

  const sendDraft = () => {
    const content = draft.trim();
    if (!content || sending) return;
    const next: UiMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    void attempt(next);
  };

  const retry = () => void attempt(messages);

  if (!config) {
    return (
      <section className="coach-quick-copy" aria-label="In-app AI chat">
        <h2>Chat in the app</h2>
        <p className="text-sm leading-6 text-white/60">Add your AI key in Settings → AI to chat here. Free options: OpenRouter free models, Google AI Studio, Groq. Your key stays on this device; the existing copy-prompt flow below keeps working without any key.</p>
      </section>
    );
  }

  const oneLiner = summarizeAiContext(state).oneLiner;

  return (
    <section className="coach-quick-copy" aria-label="In-app AI chat">
      <h2>Chat in the app</h2>
      <p className="text-xs leading-5 text-white/45">Experimental — uses the AI key saved in Settings. Training context is sent with each message; nothing else leaves the device.</p>
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto py-1" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={index}
            className={message.role === "user"
              ? "max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--lime)] px-3 py-2 text-sm leading-5 whitespace-pre-wrap text-[#11140d]"
              : "max-w-[85%] self-start rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-5 whitespace-pre-wrap text-white/85"}
          >
            {message.content}
          </div>
        ))}
        {sending && <p className="text-sm text-white/50">Thinking…</p>}
      </div>
      {messages.length === 0 && !sending && (
        <p className="text-xs leading-5 text-white/45">Context sent with each message: {oneLiner}</p>
      )}
      {error && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-200">
          <span className="break-words">{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={retry} disabled={sending}>Retry</Button>
        </p>
      )}
      <form className="mt-1 flex gap-2" onSubmit={(event) => { event.preventDefault(); sendDraft(); }}>
        <Input
          aria-label="Message the AI coach"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about your training…"
          disabled={sending}
          className="border-white/8 bg-black/15"
        />
        <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Send message"><Send /></Button>
      </form>
    </section>
  );
}
