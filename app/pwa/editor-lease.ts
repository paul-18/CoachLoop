import { localScopeSuffix } from "../persistence/local-scope";

/** Acquire without joining an unbounded queue behind a suspended Safari tab. */
export function acquireEditorLease(locks: LockManager, onOwner: () => void) {
  const controller = new AbortController();
  let disposed = false;
  let release: (() => void) | undefined;
  const name = `coach-loop-local-editor${localScopeSuffix()}`;
  const finished = locks.request(name, {
    mode: "exclusive", ifAvailable: true, signal: controller.signal,
  }, async lock => {
    if (disposed) return;
    if (!lock) throw new DOMException("Another Coach Loop window owns the editor lock", "NotAllowedError");
    const held = new Promise<void>(resolve => { release = resolve; });
    onOwner();
    await held;
  });
  const onPageHide = () => { release?.(); };
  window.addEventListener("pagehide", onPageHide);
  return {
    finished,
    dispose: () => {
      disposed = true;
      window.removeEventListener("pagehide", onPageHide);
      controller.abort();
      release?.();
    },
  };
}

/** Only our own disposed AbortError is ignored; browser aborts are interruptions. */
export function leaseAfterFinish(settled: "fulfilled" | "rejected", error: unknown, disposed: boolean): "ignore" | "interrupted" {
  if (disposed) return "ignore";
  return "interrupted";
}
