import { useEffect, useState } from "react";

export function useOfflineStatus() {
  const [offlineReady, setOfflineReady] = useState<"checking" | "ready" | "failed">("checking");
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let observedWorker: ServiceWorker | null = null;
    const checkOfflineReady = async (current: ServiceWorkerRegistration): Promise<boolean> => {
      let worker = current.waiting ?? current.active ?? navigator.serviceWorker.controller;
      if (!worker) {
        let timer: number | undefined;
        try {
          const activated = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("Offline installation timed out")), 15_000); }),
          ]);
          worker = activated.active ?? navigator.serviceWorker.controller;
        } finally { if (timer !== undefined) window.clearTimeout(timer); }
      }
      if (!worker) return false;
      const channel = new MessageChannel();
      let timeout: number | undefined;
      try {
        const response = await new Promise<{ ready?: boolean }>((resolve, reject) => {
          timeout = window.setTimeout(() => reject(new Error("Offline readiness check timed out")), 5_000);
          channel.port1.onmessage = (event) => resolve(event.data as { ready?: boolean });
          worker!.postMessage({ type: "COACH_LOOP_CHECK_OFFLINE" }, [channel.port2]);
        });
        return response.ready === true;
      } finally {
        if (timeout !== undefined) window.clearTimeout(timeout);
        channel.port1.close(); channel.port2.close();
      }
    };
    const refresh = () => {
      if (!registration || disposed) return;
      if (registration.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
      void checkOfflineReady(registration).then((ready) => {
        if (!disposed) setOfflineReady(ready ? "ready" : "failed");
      }).catch(() => { if (!disposed) setOfflineReady("failed"); });
    };
    const onWorkerState = () => {
      if (observedWorker?.state === "activated" || observedWorker?.state === "installed") refresh();
    };
    const onUpdate = () => {
      observedWorker?.removeEventListener("statechange", onWorkerState);
      observedWorker = registration?.installing ?? null;
      observedWorker?.addEventListener("statechange", onWorkerState);
    };
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" });
        if (disposed) return;
        registration.addEventListener("updatefound", onUpdate);
        navigator.serviceWorker.addEventListener("controllerchange", refresh);
        onUpdate(); refresh();
      } catch { if (!disposed) setOfflineReady("failed"); }
    };
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", refresh);
      registration?.removeEventListener("updatefound", onUpdate);
      observedWorker?.removeEventListener("statechange", onWorkerState);
    };
  }, []);
  return { offlineReady, updateReady };
}
