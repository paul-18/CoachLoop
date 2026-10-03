import { useCallback, useEffect, useRef, useState } from "react";

export function useOfflineStatus() {
  const [offlineReady, setOfflineReady] = useState<"checking" | "ready" | "failed">("checking");
  const [updateReady, setUpdateReady] = useState(false);
  const [release, setRelease] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const refreshing = useRef(false);
  const checkUpdates = useCallback(async () => {
    await registrationRef.current?.update();
  }, []);
  const applyUpdate = useCallback(async (save: () => Promise<void>) => {
    if (refreshing.current) return;
    const waiting = registrationRef.current?.waiting;
    if (!waiting) throw new Error("No downloaded update is ready yet");
    refreshing.current = true;
    const channel = new MessageChannel();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let reload: () => void = () => undefined;
    try {
      await save();
      await new Promise<void>((resolve, reject) => {
        reload = () => { resolve(); window.location.reload(); };
        navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
        timeout = setTimeout(() => reject(new Error("Update timed out; close all Coach Loop windows and reopen as a fallback")), 15_000);
        channel.port1.onmessage = event => {
          if (event.data?.applied === false) reject(new Error(event.data.reason));
        };
        waiting.postMessage({ type: "COACH_LOOP_APPLY_UPDATE" }, [channel.port2]);
      });
    } finally {
      if (timeout) clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
      refreshing.current = false;
      channel.port1.close(); channel.port2.close();
    }

  }, []);
  useEffect(() => {
    if (!import.meta.env?.PROD || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let observedWorker: ServiceWorker | null = null;
    let lastCheck = 0;
    const checkOfflineReady = async (current: ServiceWorkerRegistration) => {
      let worker = navigator.serviceWorker.controller ?? current.active;
      if (!worker) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const activated = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Installation timed out")), 15_000); })]);
          worker = activated.active ?? navigator.serviceWorker.controller;
        } finally { if (timer) clearTimeout(timer); }
      }
      if (!worker) return { ready: false, release: null };
      const channel = new MessageChannel();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        return await new Promise<{ ready: boolean; release: string | null }>((resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("Offline check timed out")), 5_000);
          channel.port1.onmessage = event => resolve({ ready: event.data?.ready === true, release: typeof event.data?.release === "string" ? event.data.release : null });
          worker!.postMessage({ type: "COACH_LOOP_CHECK_OFFLINE" }, [channel.port2]);
        });
      } finally { if (timeout) clearTimeout(timeout); channel.port1.close(); channel.port2.close(); }
    };
    const refresh = () => {
      if (!registration || disposed) return;
      setUpdateReady(!!registration.waiting && !!navigator.serviceWorker.controller);
      void checkOfflineReady(registration).then(result => { if (!disposed) { setOfflineReady(result.ready ? "ready" : "failed"); setRelease(result.release); } }).catch(() => { if (!disposed) setOfflineReady("failed"); });
    };
    const onState = () => { if (["installed", "activated"].includes(observedWorker?.state ?? "")) refresh(); };
    const onUpdate = () => { observedWorker?.removeEventListener("statechange", onState); observedWorker = registration?.installing ?? null; observedWorker?.addEventListener("statechange", onState); };
    const foreground = () => {
      if (document.visibilityState !== "visible") return;
      refresh();
      if (navigator.onLine !== false && Date.now() - lastCheck > 60_000) { lastCheck = Date.now(); void registration?.update().catch(() => undefined); }
    };
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" });
        if (disposed) return;
        registrationRef.current = registration;
        registration.addEventListener("updatefound", onUpdate);
        navigator.serviceWorker.addEventListener("controllerchange", refresh);
        onUpdate(); refresh(); foreground();
      } catch { if (!disposed) setOfflineReady("failed"); }
    };
    if (document.readyState === "complete") void register(); else window.addEventListener("load", register, { once: true });
    document.addEventListener("visibilitychange", foreground); window.addEventListener("online", foreground);
    return () => {
      disposed = true; window.removeEventListener("load", register); window.removeEventListener("online", foreground); document.removeEventListener("visibilitychange", foreground);
      navigator.serviceWorker.removeEventListener("controllerchange", refresh); registration?.removeEventListener("updatefound", onUpdate); observedWorker?.removeEventListener("statechange", onState);
    };
  }, []);
  return { offlineReady, updateReady, release, checkUpdates, applyUpdate };
}
