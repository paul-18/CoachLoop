import { localScopeSuffix } from "../persistence/local-scope";

/** Queue rather than fail when a previous tab is still closing. */
export function acquireEditorLease(locks: LockManager, onOwner: () => void) {
  const controller = new AbortController();
  let disposed = false;
  let release: (() => void) | undefined;
  const finished = locks.request(`coach-loop-local-editor${localScopeSuffix()}`, {
    mode: "exclusive", signal: controller.signal,
  }, async () => {
    if (disposed) return;
    const held = new Promise<void>(resolve => { release = resolve; });
    onOwner();
    await held;
  });
  return {
    finished,
    dispose: () => { disposed = true; controller.abort(); release?.(); },
  };
}

/** Own cleanup aborts the request. Any other ending, while this window is still mounted, is an interruption — not proof the browser lacks Web Locks. */
export function leaseAfterFinish(settled: "fulfilled" | "rejected", error: unknown, disposed: boolean): "ignore" | "interrupted" {
  if (disposed) return "ignore";
  if (settled === "rejected" && error instanceof DOMException && error.name === "AbortError") return "ignore";
  return "interrupted";
}
