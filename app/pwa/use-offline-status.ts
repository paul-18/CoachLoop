import { useEffect, useState } from "react";

export function useOfflineStatus() {
  const [offlineReady, setOfflineReady] = useState<"checking" | "ready" | "failed">("checking");
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let disposed = false;
    const checkOfflineReady = async (registration: ServiceWorkerRegistration) => {
      const worker = registration.waiting ?? registration.active ?? navigator.serviceWorker.controller;
      if (!worker) throw new Error("No active service worker");

      const channel = new MessageChannel();
      const response = await new Promise<{ ready?: boolean }>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Offline readiness check timed out")), 5_000);
        channel.port1.onmessage = (event) => {
          window.clearTimeout(timeout);
          resolve(event.data as { ready?: boolean });
        };
        worker.postMessage({ type: "COACH_LOOP_CHECK_OFFLINE" }, [channel.port2]);
      });

      return response.ready === true;
    };
    const announceWaitingUpdate = (registration: ServiceWorkerRegistration) => {
      if (!disposed && registration.waiting) setUpdateReady(true);
    };
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" });
        if (disposed) return;
        try {
          const ready = await checkOfflineReady(registration);
          if (!disposed) setOfflineReady(ready ? "ready" : "failed");
        } catch {
          if (!disposed) setOfflineReady("failed");
        }
        announceWaitingUpdate(registration);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) announceWaitingUpdate(registration);
          });
        });
      } catch {
        if (!disposed) setOfflineReady("failed");
      }
    };
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return { offlineReady, updateReady };
}
