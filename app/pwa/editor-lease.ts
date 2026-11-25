import { localScopeSuffix } from "../persistence/local-scope";

/** Acquire without joining an unbounded queue behind a suspended Safari tab. */
export function acquireEditorLease(locks: LockManager, onOwner: () => void) {
  let disposed = false;
  let release: (() => void) | undefined;
  const name = `coach-loop-local-editor${localScopeSuffix()}`;
  // NOTE: do NOT pass an AbortSignal here. WebKit rejects
  // locks.request() with NotSupportedError when `ifAvailable: true` is
  // combined with a signal ("steal and ifAvailable need to be false when a
  // signal is provided"), which made the app unusable in Safari/WebKit
  // (the lease gate showed "The editor lock stopped" on every load).
  // With ifAvailable the request resolves immediately either way, so there
  // is no queued request that would need aborting; disposal is handled by
  // the `disposed` flag and release() below.
  const finished = locks.request(name, {
    mode: "exclusive", ifAvailable: true,
  }, async lock => {
    if (disposed) return;
    if (!lock) throw new DOMException("Another Coach Loop window owns the editor lock", "NotAllowedError");
    const held = new Promise<void>(resolve => { release = resolve; });
    onOwner();
    await held;
  });
  const onPageHide = () => { release?.(); };
  // Node test runs have no window; the browser path always does.
  if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);
  return {
    finished,
    dispose: () => {
      disposed = true;
      if (typeof window !== "undefined") window.removeEventListener("pagehide", onPageHide);
      release?.();
    },
  };
}

/** Only our own disposed AbortError is ignored; browser aborts are interruptions. */
export function leaseAfterFinish(settled: "fulfilled" | "rejected", error: unknown, disposed: boolean): "ignore" | "interrupted" {
  if (disposed) return "ignore";
  if (settled === "rejected" && error instanceof DOMException && error.name === "AbortError") return "interrupted";
  return "interrupted";
}
