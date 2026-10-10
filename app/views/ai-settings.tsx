"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TrainingState } from "../domain/training-types";
import { AI_PROVIDER_PRESETS, AiClientError, sendChatMessage, type AiProviderId } from "../ai/ai-client";
import { buildAiConfig, nextModelForProviderChange } from "../ai/ai-settings-logic";

type SettingsUpdate = (update: (settings: TrainingState["settings"]) => TrainingState["settings"]) => void;

const PROVIDER_IDS = Object.keys(AI_PROVIDER_PRESETS) as AiProviderId[];

/** AI provider settings for the experimental in-app coach chat. Mirrors the
 * NotificationSettings section pattern: content only; the section chrome lives in SettingsView. */
export function AISettings({
  settings,
  onUpdate,
}: {
  settings: TrainingState["settings"];
  onUpdate: SettingsUpdate;
}) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const provider: AiProviderId = settings.aiProvider ?? "openrouter";
  const preset = AI_PROVIDER_PRESETS[provider];
  const hasKey = Boolean(settings.aiApiKey?.trim());

  const changeProvider = (next: AiProviderId) => {
    onUpdate((current) => ({
      ...current,
      aiProvider: next,
      aiModel: nextModelForProviderChange(current.aiModel, provider, next),
    }));
  };

  const testConnection = async () => {
    const config = buildAiConfig(settings);
    if (!config) return;
    setTesting(true);
    setTestResult("");
    try {
      await sendChatMessage(config, [{ role: "user", content: "Reply with exactly: ok" }]);
      setTestResult("Connected — model replied.");
      toast.success("AI connection works");
    } catch (error) {
      setTestResult(error instanceof AiClientError ? error.message : error instanceof Error ? error.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  const clearKey = () => {
    if (!window.confirm("Remove the AI key stored on this device?")) return;
    onUpdate((current) => ({ ...current, aiApiKey: undefined }));
    setTestResult("");
    toast.success("AI key removed");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/65">
        Experimental: chat with an AI coach inside the Coach tab using your own API key. Your key and your training stay on this device.
      </p>
      <label className="field-label block">Provider
        <NativeSelect aria-label="AI provider" value={provider} onChange={(event) => changeProvider(event.target.value as AiProviderId)} className="mt-2 w-full">
          {PROVIDER_IDS.map((id) => <NativeSelectOption key={id} value={id}>{AI_PROVIDER_PRESETS[id].label}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      <div>
        <label className="field-label block" htmlFor="ai-api-key">API key</label>
        <div className="mt-2 flex gap-2">
          <Input
            id="ai-api-key"
            type={showKey ? "text" : "password"}
            value={settings.aiApiKey ?? ""}
            onChange={(event) => onUpdate((current) => ({ ...current, aiApiKey: event.target.value.trim() ? event.target.value : undefined }))}
            placeholder="Paste your key"
            autoComplete="off"
            className="border-white/8 bg-black/15"
          />
          <Button type="button" variant="ghost" size="icon" aria-label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey((value) => !value)}>
            {showKey ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        <p className="mt-1 text-xs leading-5 text-white/45">Stored only on this device. Never included in backups.</p>
        {preset.keyHelpUrl && <a href={preset.keyHelpUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-[var(--lime)] underline underline-offset-2">{preset.keyHelpLabel}</a>}
      </div>
      <label className="field-label block">Model
        <Input
          aria-label="AI model"
          value={settings.aiModel ?? ""}
          onChange={(event) => onUpdate((current) => ({ ...current, aiModel: event.target.value }))}
          placeholder={preset.defaultModel || "Model id"}
          className="mt-2 border-white/8 bg-black/15"
        />
      </label>
      {!preset.defaultModel && <p className="text-xs leading-5 text-white/45">Enter the exact model id. OpenRouter free models are tagged :free.</p>}
      {provider === "custom" && (
        <label className="field-label block">Base URL
          <Input
            aria-label="Custom provider base URL"
            value={settings.aiBaseUrl ?? ""}
            onChange={(event) => onUpdate((current) => ({ ...current, aiBaseUrl: event.target.value }))}
            placeholder="https://your-provider.example/v1"
            autoComplete="off"
            className="mt-2 border-white/8 bg-black/15"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={testing || !hasKey} onClick={() => void testConnection()}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {hasKey && <Button variant="ghost" onClick={clearKey}>Clear key</Button>}
      </div>
      {testResult && <p role="status" className="text-sm text-white/65">{testResult}</p>}
    </div>
  );
}
