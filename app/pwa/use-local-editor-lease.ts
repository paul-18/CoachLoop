import { useEffect, useState } from "react";

type Lease = "checking" | "owner" | "busy" | "unsupported";

/** Keep one writable Coach Loop context for the shared IndexedDB snapshot. */
export function useLocalEditorLease(): Lease {
  const [lease, setLease] = useState<Lease>("checking");
  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    if (!navigator.locks) {
      // The HTTP development preview is not a secure context, so Web Locks is absent.
      // Production keeps the single-editor guard; this only permits local QA.
      setLease(import.meta.env.PROD ? "unsupported" : "owner");
      return;
    }
    void navigator.locks.request("coach-loop-local-editor", { mode: "exclusive", ifAvailable: true }, async (lock) => {
      if (disposed) return;
      if (!lock) { setLease("busy"); return; }
      setLease("owner");
      await new Promise<void>((resolve) => { release = resolve; });
    }).catch(() => { if (!disposed) setLease("unsupported"); });
    return () => { disposed = true; release?.(); };
  }, []);
  return lease;
}
