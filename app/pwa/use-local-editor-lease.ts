import { useEffect, useState } from "react";
import { acquireEditorLease } from "./editor-lease";

type Lease = "checking" | "owner" | "busy" | "unsupported";

/** Keep one writable Coach Loop context for the shared IndexedDB snapshot. */
export function useLocalEditorLease(): Lease {
  const [lease, setLease] = useState<Lease>("checking");
  useEffect(() => {
    let disposed = false;
    if (!navigator.locks) {
      // The HTTP development preview is not a secure context, so Web Locks is absent.
      // Production keeps the single-editor guard; this only permits local QA.
      // Resolve browser capability after mounting in a client environment.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLease(import.meta.env.PROD ? "unsupported" : "owner");
      return;
    }
    // A reload may race the previous document releasing its lock. Stay queued
    // and open automatically; do not require repeated reloads or storage resets.
    const waiting = window.setTimeout(() => { if (!disposed) setLease("busy"); }, 750);
    const request = acquireEditorLease(navigator.locks, () => {
      window.clearTimeout(waiting);
      setLease("owner");
    });
    void request.finished.catch(() => { window.clearTimeout(waiting); if (!disposed) setLease("unsupported"); });
    return () => { disposed = true; window.clearTimeout(waiting); request.dispose(); };
  }, []);
  return lease;
}
