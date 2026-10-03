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
