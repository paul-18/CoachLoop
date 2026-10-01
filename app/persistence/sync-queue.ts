/** A single coordinator that remembers reads and writes independently. */
export function createSyncQueue(
  pull: () => Promise<void>,
  push: () => Promise<void>,
  onError: (error: unknown) => void,
) {
  let running = false;
  let pullPending = false;
  let pushPending = false;
  let paused = false;
  const idleWaiters: Array<() => void> = [];
  const drain = async () => {
    if (running || paused) return;
    running = true;
    try {
      while (!paused && (pullPending || pushPending)) {
        if (pullPending) {
          pullPending = false;
          try { await pull(); } catch (error) { pullPending = true; throw error; }
        }
        if (pushPending) {
          pushPending = false;
          try { await push(); } catch (error) { pushPending = true; throw error; }
        }
      }
    } catch (error) { onError(error); }
    finally { running = false; idleWaiters.splice(0).forEach((resolve) => resolve()); }
  };
  return {
    requestPull() { if (paused) return; pullPending = true; void drain(); },
    requestPush() { if (paused) return; pushPending = true; void drain(); },
    retry() { void drain(); },
    async pauseAndDrain() {
      paused = true;
      pullPending = false;
      pushPending = false;
      if (running) await new Promise<void>((resolve) => idleWaiters.push(resolve));
      pullPending = false;
      pushPending = false;
    },
    resume() { paused = false; void drain(); },
    pending() { return { pull: pullPending, push: pushPending }; },
  };
}
