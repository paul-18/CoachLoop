import { useCallback, useEffect, useRef, useState } from "react";
export function useStorageHealth() {
  const [health, setHealth] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });
  const requestId = useRef(0);
  const refresh = useCallback(async (requestPersist = false) => {
    const id = ++requestId.current;
    const store = navigator.storage;
    let persisted: boolean | null = null;
    try {
      persisted = store?.persisted ? await store.persisted() : null;
      if (requestPersist && persisted === false && store.persist) persisted = await store.persist();
    } catch { /* Preserve a valid persisted() result if persist() fails. */ }
    let estimate: StorageEstimate | undefined;
    try { estimate = await store?.estimate?.(); } catch { /* Estimates are optional. */ }
    if (id === requestId.current) setHealth({ persisted, ...estimate });
  }, []);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) void refresh(false); });
    const visible = () => { if (document.visibilityState === "visible") void refresh(false); };
    document.addEventListener("visibilitychange", visible);
    return () => { mounted = false; requestId.current++; document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  return { health, refresh };
}
