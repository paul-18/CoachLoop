import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AI_PROVIDER_PRESETS } from "../app/ai/ai-client";
import { buildAiConfig, defaultModelFor, nextModelForProviderChange } from "../app/ai/ai-settings-logic";
import { defaultState, type AppSettings } from "../app/domain/training-types";
import { AISettings } from "../app/views/ai-settings";
import { AICoachChat } from "../app/views/ai-chat";

const noop = () => {};
const withSettings = (overrides: Partial<AppSettings>) => ({ ...defaultState().settings, ...overrides });

test("defaultModelFor returns each preset's default model", () => {
  assert.equal(defaultModelFor("openai"), AI_PROVIDER_PRESETS.openai.defaultModel);
  assert.equal(defaultModelFor("gemini"), AI_PROVIDER_PRESETS.gemini.defaultModel);
  assert.equal(defaultModelFor("groq"), AI_PROVIDER_PRESETS.groq.defaultModel);
  assert.equal(defaultModelFor("openrouter"), "");
  assert.equal(defaultModelFor("custom"), "");
});

test("buildAiConfig returns null when no key is set", () => {
  assert.equal(buildAiConfig(withSettings({})), null);
  assert.equal(buildAiConfig(withSettings({ aiApiKey: "   " })), null);
  assert.equal(buildAiConfig(withSettings({ aiProvider: "openai", aiApiKey: "" })), null);
});

test("buildAiConfig resolves a preset endpoint and falls back to the preset default model", () => {
  const config = buildAiConfig(withSettings({ aiProvider: "openai", aiApiKey: "  sk-test  ", aiModel: "" }));
  assert.deepEqual(config, { baseURL: AI_PROVIDER_PRESETS.openai.baseURL, apiKey: "sk-test", model: AI_PROVIDER_PRESETS.openai.defaultModel });
});

test("buildAiConfig keeps an explicitly typed model and defaults the provider to openrouter", () => {
  const config = buildAiConfig(withSettings({ aiApiKey: "k", aiModel: "gpt-4o" }));
  assert.equal(config?.baseURL, AI_PROVIDER_PRESETS.openrouter.baseURL);
  assert.equal(config?.model, "gpt-4o");
});

test("buildAiConfig uses the custom base URL for the custom provider", () => {
  const config = buildAiConfig(withSettings({ aiProvider: "custom", aiApiKey: "k", aiModel: "my-model", aiBaseUrl: " https://example.test/v1/ " }));
  assert.deepEqual(config, { baseURL: "https://example.test/v1/", apiKey: "k", model: "my-model" });
});

test("nextModelForProviderChange keeps a custom model but adopts the new preset default otherwise", () => {
  // Empty field adopts the new default.
  assert.equal(nextModelForProviderChange("", "openai", "gemini"), AI_PROVIDER_PRESETS.gemini.defaultModel);
  assert.equal(nextModelForProviderChange(undefined, "openai", "groq"), AI_PROVIDER_PRESETS.groq.defaultModel);
  // Field still holding the old preset's default adopts the new default.
  assert.equal(
    nextModelForProviderChange(AI_PROVIDER_PRESETS.openai.defaultModel, "openai", "gemini"),
    AI_PROVIDER_PRESETS.gemini.defaultModel,
  );
  // A genuinely custom model survives the switch.
  assert.equal(nextModelForProviderChange("gpt-4o", "openai", "gemini"), "gpt-4o");
});

test("AISettings renders the provider dropdown and masked key field", () => {
  const html = renderToStaticMarkup(createElement(AISettings, { settings: withSettings({}), onUpdate: noop }));
  assert.match(html, /AI provider/);
  assert.match(html, /OpenRouter/);
  assert.match(html, /type="password"/);
  assert.match(html, /Never included in backups/);
  assert.match(html, /Test connection/);
});

test("AISettings shows the base URL field only for the custom provider", () => {
  const presetHtml = renderToStaticMarkup(createElement(AISettings, { settings: withSettings({ aiProvider: "openai", aiApiKey: "k" }), onUpdate: noop }));
  assert.doesNotMatch(presetHtml, /Custom provider base URL/);
  const customHtml = renderToStaticMarkup(createElement(AISettings, { settings: withSettings({ aiProvider: "custom", aiApiKey: "k" }), onUpdate: noop }));
  assert.match(customHtml, /Custom provider base URL/);
});

test("AICoachChat shows the guidance card when no key is set", () => {
  const html = renderToStaticMarkup(createElement(AICoachChat, { state: defaultState() }));
  assert.match(html, /Add your AI key in Settings/);
  assert.match(html, /existing copy-prompt flow below keeps working without any key/);
  assert.doesNotMatch(html, /Context sent with each message/);
});

test("AICoachChat shows the chat UI and context one-liner when a key is set", () => {
  const state = defaultState();
  state.settings.aiApiKey = "k";
  const html = renderToStaticMarkup(createElement(AICoachChat, { state }));
  assert.match(html, /Context sent with each message:/);
  assert.match(html, /Message the AI coach/);
  assert.match(html, /Ask about your training/);
  assert.doesNotMatch(html, /Add your AI key in Settings/);
});
