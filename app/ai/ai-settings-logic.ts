/** Pure helpers for the experimental AI coach settings. Kept DOM-free so the rules
 * are unit-testable; the Settings UI and chat components consume these. */
import type { AppSettings } from "../domain/training-types";
import { AI_PROVIDER_PRESETS, type AiProviderConfig, type AiProviderId } from "./ai-client";

/** The preset's default model for a provider. Empty string means the provider has no
 * fixed default and the model field stays blank for the user to fill in. */
export function defaultModelFor(provider: AiProviderId): string {
  return AI_PROVIDER_PRESETS[provider].defaultModel;
}

/** Next model value when the provider changes: keep a custom model the user typed,
 * otherwise adopt the new preset's default (this includes an empty field and a field
 * that still holds the previous preset's default). */
export function nextModelForProviderChange(
  currentModel: string | undefined,
  from: AiProviderId,
  to: AiProviderId,
): string {
  const trimmed = currentModel?.trim() ?? "";
  if (trimmed && trimmed !== defaultModelFor(from)) return trimmed;
  return defaultModelFor(to);
}

/** Resolve the settings' AI fields into a client config, or null when no key is set.
 * A blank model falls back to the preset's default; the "custom" provider uses the
 * stored base URL instead of a preset endpoint. */
export function buildAiConfig(settings: AppSettings): AiProviderConfig | null {
  const apiKey = settings.aiApiKey?.trim();
  if (!apiKey) return null;
  const provider: AiProviderId = settings.aiProvider ?? "openrouter";
  const preset = AI_PROVIDER_PRESETS[provider];
  const model = settings.aiModel?.trim() || preset.defaultModel;
  const baseURL = provider === "custom" ? settings.aiBaseUrl?.trim() || "" : preset.baseURL;
  return { baseURL, apiKey, model };
}
