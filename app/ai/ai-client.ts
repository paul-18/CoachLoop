/** Minimal OpenAI-compatible chat client for the built-in AI coach experiment. The API key
 * stays on the device (settings) and is excluded from backup exports; it is never logged. */

export type AiProviderId = "openrouter" | "openai" | "gemini" | "groq" | "custom";

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export class AiClientError extends Error {
  kind: "bad-key" | "network" | "bad-response" | "rate-limited" | "unknown";
  httpStatus?: number;
  constructor(kind: AiClientError["kind"], message: string, httpStatus?: number) {
    super(message);
    this.name = "AiClientError";
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

/** POST one non-streaming chat-completions request and return the assistant reply text. */
export async function sendChatMessage(
  config: AiProviderConfig,
  messages: AiChatMessage[],
): Promise<{ reply: string }> {
  const baseURL = config.baseURL.replace(/\/+$/, "");
  const url = `${baseURL}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages }),
    });
  } catch (error) {
    // Scrub before surfacing: a provider URL echoing back in the failure could theoretically carry the key.
    const detail = error instanceof Error ? error.message : "";
    const safe = config.apiKey ? detail.split(config.apiKey).join("[redacted]") : detail;
    throw new AiClientError(
      "network",
      safe ? `Network error contacting the AI provider: ${safe}` : "Network error contacting the AI provider",
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new AiClientError("bad-key", "API key was rejected", response.status);
  }
  if (response.status === 429) {
    throw new AiClientError("rate-limited", "Rate limit reached. Wait a moment and try again.", response.status);
  }
  if (!response.ok) {
    throw new AiClientError("unknown", `AI provider returned status ${response.status}`, response.status);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiClientError("bad-response", "AI provider returned an unreadable response", response.status);
  }
  const content = (payload as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiClientError("bad-response", "AI provider returned an empty reply", response.status);
  }
  return { reply: content };
}

export interface AiProviderPreset {
  label: string;
  baseURL: string;
  defaultModel: string;
  keyHelpUrl: string;
  keyHelpLabel: string;
}

export const AI_PROVIDER_PRESETS: Record<AiProviderId, AiProviderPreset> = {
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "",
    keyHelpUrl: "https://openrouter.ai/keys",
    keyHelpLabel: "Get an OpenRouter key (a :free model works for the experiment)",
  },
  openai: {
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyHelpUrl: "https://platform.openai.com/api-keys",
    keyHelpLabel: "Get an OpenAI key",
  },
  gemini: {
    label: "Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
    keyHelpUrl: "https://aistudio.google.com/apikey",
    keyHelpLabel: "Get a Gemini key",
  },
  groq: {
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyHelpUrl: "https://console.groq.com/keys",
    keyHelpLabel: "Get a Groq key",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    baseURL: "",
    defaultModel: "",
    keyHelpUrl: "",
    keyHelpLabel: "Get a key from your provider",
  },
};
