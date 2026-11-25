import { useEffect, useState } from "react";

export function useWakeLock() {
  const [keepAwakeRequested, setKeepAwakeRequested] = useState(false);
  const [wakeLockHeld, setWakeLockHeld] = useState(false);
  type WakeLockSentinelLike = {
    released?: boolean;
    release: () => Promise<void>;
    addEventListener: (type: "release", listener: () => void) => void;
  };
  useEffect(() => {
    if (!keepAwakeRequested) return;
    let disposed = false, pending = false, retries = 0;
    let sentinel: WakeLockSentinelLike | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const maxRetries = 3;
    const acquire = async () => {
      if (disposed || pending || (sentinel && !sentinel.released) || document.visibilityState !== "visible") return;
      if (sentinel?.released) sentinel = null;
      pending = true;
      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
        if (!wakeLock) throw new Error("unsupported");
        const next = await wakeLock.request("screen");
        if (disposed || document.visibilityState !== "visible") { await next.release(); return; }
        sentinel = next; retries = 0; setWakeLockHeld(true);
        next.addEventListener("release", () => {
          if (sentinel !== next) return;
          sentinel = null; setWakeLockHeld(false);
          if (disposed || document.visibilityState !== "visible" || retries >= maxRetries) return;
          const delay = Math.min(4000, 250 * 2 ** retries++);
          clearTimeout(retryTimer); retryTimer = setTimeout(() => { void acquire(); }, delay);
        });
      } catch { if (!disposed) setWakeLockHeld(false); }
      finally { pending = false; }
    };
    const onResume = () => { if (document.visibilityState === "visible") void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("focus", onResume);
    return () => {
      disposed = true; clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("focus", onResume);
      void sentinel?.release(); setWakeLockHeld(false);
    };
  }, [keepAwakeRequested]);
  return { keepAwakeRequested, setKeepAwakeRequested, wakeLockHeld };
}
