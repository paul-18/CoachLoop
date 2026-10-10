import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_PROVIDER_PRESETS,
  AiClientError,
  sendChatMessage,
  type AiChatMessage,
  type AiProviderConfig,
} from "../app/ai/ai-client";

const KEY = "sk-test-SECRET-KEY-99999";
const MESSAGES: AiChatMessage[] = [
  { role: "system", content: "You are a coach." },
  { role: "user", content: "What should I do today?" },
];
const configFor = (overrides: Partial<AiProviderConfig> = {}): AiProviderConfig => ({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: KEY,
  model: "meta-llama/llama-3.3-70b-instruct:free",
  ...overrides,
});

const mockResponse = (status: number, body: unknown, jsonThrows = false) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: jsonThrows
      ? async () => {
          throw new Error("Unexpected token");
        }
      : async () => body,
  }) as unknown as Response;

const realFetch = globalThis.fetch;
const installFetch = (handler: (url: string, init: RequestInit) => Promise<Response>) => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init ?? {})) as typeof fetch;
};
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("posts model and messages to /chat/completions with Bearer auth", async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  installFetch(async (url, init) => {
    seen.push({ url, init });
    return mockResponse(200, { choices: [{ message: { role: "assistant", content: "Train legs." } }] });
  });
  const result = await sendChatMessage(configFor(), MESSAGES);
  assert.equal(result.reply, "Train legs.");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://openrouter.ai/api/v1/chat/completions");
  const headers = seen[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${KEY}`);
  assert.equal(headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(seen[0].init.body)), { model: configFor().model, messages: MESSAGES });
});

test("trims trailing slashes on the base URL", async () => {
  const seen: string[] = [];
  installFetch(async (url) => {
    seen.push(url);
    return mockResponse(200, { choices: [{ message: { content: "ok" } }] });
  });
  await sendChatMessage(configFor({ baseURL: AI_PROVIDER_PRESETS.gemini.baseURL }), MESSAGES);
  assert.equal(seen[0], "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
});

test("401 and 403 map to bad-key", async () => {
  for (const status of [401, 403]) {
    installFetch(async () => mockResponse(status, { error: "invalid key" }));
    const error = await sendChatMessage(configFor(), MESSAGES).catch((err) => err);
    assert.ok(error instanceof AiClientError);
    assert.equal(error.kind, "bad-key");
    assert.equal(error.httpStatus, status);
    assert.match(error.message, /API key was rejected/);
  }
});

test("429 maps to rate-limited", async () => {
  installFetch(async () => mockResponse(429, { error: "too many" }));
  const error = await sendChatMessage(configFor(), MESSAGES).catch((err) => err);
  assert.ok(error instanceof AiClientError);
  assert.equal(error.kind, "rate-limited");
  assert.equal(error.httpStatus, 429);
});

test("network throw maps to network", async () => {
  installFetch(async () => {
    throw new TypeError("fetch failed");
  });
  const error = await sendChatMessage(configFor(), MESSAGES).catch((err) => err);
  assert.ok(error instanceof AiClientError);
  assert.equal(error.kind, "network");
});

test("malformed JSON and missing content map to bad-response", async () => {
  const cases: [string, () => Promise<Response>][] = [
    ["garbage body", async () => mockResponse(200, null, true)],
    ["no choices", async () => mockResponse(200, { choices: [] })],
    ["missing content", async () => mockResponse(200, { choices: [{ message: {} }] })],
    ["empty content", async () => mockResponse(200, { choices: [{ message: { content: "  " } }] })],
  ];
  for (const [label, respond] of cases) {
    installFetch(async () => respond());
    const error = await sendChatMessage(configFor(), MESSAGES).catch((err) => err);
    assert.ok(error instanceof AiClientError, label);
    assert.equal(error.kind, "bad-response", label);
  }
});

test("thrown errors never contain the API key", async () => {
  const scenarios: (() => Promise<Response>)[] = [
    async () => mockResponse(401, { error: { message: `bad key ${KEY}` } }),
    async () => mockResponse(429, {}),
    async () => {
      throw new Error(`connection reset for ${KEY}`);
    },
    async () => mockResponse(200, null, true),
  ];
  for (const respond of scenarios) {
    installFetch(async () => respond());
    const error = await sendChatMessage(configFor(), MESSAGES).catch((err) => err);
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes(KEY), `key leaked in: ${error.message}`);
    assert.ok(!(error instanceof AiClientError) || error.kind !== undefined);
  }
});

test("provider presets cover all ids with documented endpoints and key help", () => {
  assert.deepEqual(Object.keys(AI_PROVIDER_PRESETS).sort(), ["custom", "gemini", "groq", "openai", "openrouter"]);
  assert.equal(AI_PROVIDER_PRESETS.openrouter.baseURL, "https://openrouter.ai/api/v1");
  assert.equal(AI_PROVIDER_PRESETS.openai.baseURL, "https://api.openai.com/v1");
  assert.equal(AI_PROVIDER_PRESETS.gemini.baseURL, "https://generativelanguage.googleapis.com/v1beta/openai/");
  assert.equal(AI_PROVIDER_PRESETS.groq.baseURL, "https://api.groq.com/openai/v1");
  assert.equal(AI_PROVIDER_PRESETS.openai.defaultModel, "gpt-4o-mini");
  assert.equal(AI_PROVIDER_PRESETS.groq.defaultModel, "llama-3.3-70b-versatile");
  assert.equal(AI_PROVIDER_PRESETS.gemini.defaultModel, "gemini-2.0-flash");
  assert.equal(AI_PROVIDER_PRESETS.openrouter.keyHelpUrl, "https://openrouter.ai/keys");
  assert.equal(AI_PROVIDER_PRESETS.openai.keyHelpUrl, "https://platform.openai.com/api-keys");
  assert.equal(AI_PROVIDER_PRESETS.gemini.keyHelpUrl, "https://aistudio.google.com/apikey");
  assert.equal(AI_PROVIDER_PRESETS.groq.keyHelpUrl, "https://console.groq.com/keys");
});
