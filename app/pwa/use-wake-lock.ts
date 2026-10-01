import { useEffect, useState } from "react";

export function useWakeLock() {
  const [keepAwakeRequested, setKeepAwakeRequested] = useState(false);
  const [wakeLockHeld, setWakeLockHeld] = useState(false);
  type WakeLockSentinelLike = {
    release: () => Promise<void>;
    addEventListener: (type: "release", listener: () => void) => void;
  };
  useEffect(() => {
    if (!keepAwakeRequested) return;

    let disposed = false;
    let pending = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async () => {
      if (disposed || pending || sentinel || document.visibilityState !== "visible") return;
      pending = true;

      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
        if (!wakeLock) throw new Error("unsupported");
        const next = await wakeLock.request("screen");

        if (disposed) {
          await next.release();
          return;
        }

        sentinel = next;
        setWakeLockHeld(true);
        next.addEventListener("release", () => {
          if (sentinel !== next) return;
          sentinel = null;
          setWakeLockHeld(false);
        });
      } catch {
        if (!disposed) setWakeLockHeld(false);
      } finally {
        pending = false;
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release();
      setWakeLockHeld(false);
    };
  }, [keepAwakeRequested]);
  return { keepAwakeRequested, setKeepAwakeRequested, wakeLockHeld };
}
