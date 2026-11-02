"use client";

import { Toaster } from "@/components/ui/sonner";
import { EditorGate } from "./shell/editor-gate";
import { StorageStatus } from "./shell/storage-status";
import { AppScreens } from "./shell/app-screens";
import { AppDialogs } from "./shell/app-dialogs";
import { useShellModel } from "./shell/use-shell-model";

export default function CoachLoop() {
  return <EditorGate><WorkoutApp /></EditorGate>;
}

/** Composition only: persistence, navigation and workout ownership live in controllers. */
function WorkoutApp() {
  const model = useShellModel();
  const { ready, loadError, busy } = model.persistence;
  if (!ready || busy || model.updating) {
    return <StorageStatus ready={ready} loadError={loadError} updating={model.updating} />;
  }
  return <>
    <AppScreens model={model} />
    <AppDialogs model={model} />
    <Toaster position="top-center" />
  </>;
}
