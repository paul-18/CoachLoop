import { useCallback, useEffect, useState } from "react";
export function useStorageHealth() {
  const [health, setHealth] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });
  const refresh = useCallback(async () => {
    try {
      const store = navigator.storage;
      let persisted = store?.persisted ? await store.persisted() : null;
      if (persisted === false && store.persist) persisted = await store.persist();
      const estimate = await store?.estimate?.();
      setHealth({ persisted, ...estimate });
    } catch { setHealth({ persisted: null }); }
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); const visible = () => { if (document.visibilityState === "visible") void refresh(); }; document.addEventListener("visibilitychange", visible); return () => document.removeEventListener("visibilitychange", visible); }, [refresh]);
  return { health, refresh };
}
