import { useCallback, useEffect, useState } from "react";
export function useStorageHealth() {
  const [health, setHealth] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });
  const refresh = useCallback(async (requestPersist = false) => {
    try {
      const store = navigator.storage;
      let persisted = store?.persisted ? await store.persisted() : null;
      if (requestPersist && persisted === false && store.persist) persisted = await store.persist();
      const estimate = await store?.estimate?.();
      setHealth({ persisted, ...estimate });
    } catch { setHealth({ persisted: null }); }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => refresh(true));
    const visible = () => { if (document.visibilityState === "visible") void refresh(false); };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [refresh]);
  return { health, refresh };
}
