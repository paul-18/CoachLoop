import { useCallback, useEffect, useState } from "react";
import { acquireEditorLease, leaseAfterFinish } from "./editor-lease";

type Lease = "checking" | "owner" | "busy" | "unsupported" | "interrupted";

/** Keep one writable Coach Loop context for the shared IndexedDB snapshot. */
export function useLocalEditorLease(): { lease: Lease; retry: () => void } {
  const [lease, setLease] = useState<Lease>("checking");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setLease("checking");
    setAttempt((value) => value + 1);
  }, []);
  useEffect(() => {
    let disposed = false;
    if (!navigator.locks) {
      // The HTTP development preview is not a secure context, so Web Locks is absent.
      // Production keeps the single-editor guard; this only permits local QA.
      // Resolve browser capability after mounting in a client environment.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLease(import.meta.env?.PROD ? "unsupported" : "owner");
      return;
    }
    // A reload may race the previous document releasing its lock. Stay queued
    // and open automatically; do not require repeated reloads or storage resets.
    const waiting = window.setTimeout(() => { if (!disposed) setLease("busy"); }, 750);
    const request = acquireEditorLease(navigator.locks, () => {
      window.clearTimeout(waiting);
      if (!disposed) setLease("owner");
    });
    const settle = (settled: "fulfilled" | "rejected", error?: unknown) => {
      window.clearTimeout(waiting);
      if (leaseAfterFinish(settled, error, disposed) === "interrupted") setLease("interrupted");
    };
    void request.finished.then(() => settle("fulfilled"), (error: unknown) => settle("rejected", error));
    return () => { disposed = true; window.clearTimeout(waiting); request.dispose(); };
  }, [attempt]);
  useEffect(() => {
    if (lease !== "interrupted") return;
    let used = false;
    const onVisible = () => {
      if (used || document.visibilityState !== "visible") return;
      used = true;
      retry();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [lease, retry]);
  return { lease, retry };
}