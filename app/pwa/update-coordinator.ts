interface UpdateEnvironment {
  workerEvents: EventTarget;
  pageEvents: EventTarget;
  waiting: () => ServiceWorker | null;
  controller: () => ServiceWorker | null;
  visible: () => boolean;
  reload: () => void;
}
interface Intent {
  worker: ServiceWorker;
  save: () => Promise<void>;
  safe: () => boolean;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  channel: MessageChannel;
}

/** Only a deliberately requested worker may restart the page. A UI timeout
 * does not cancel an activation already sent to the browser. Keep that intent
 * and re-flush on a visible, safe return before the single reload. */
export function createUpdateCoordinator(env: UpdateEnvironment, timeoutMs = 15_000) {
  let intent: Intent | null = null;
  let requesting = false, reconciling = false, reloaded = false, disposed = false;
  const clear = (current: Intent) => {
    clearTimeout(current.timer); current.channel.port1.close(); current.channel.port2.close();
    if (intent === current) intent = null;
  };
  const reconcile = async () => {
    const current = intent;
    if (!current || reconciling || reloaded || disposed || !env.visible() || !current.safe() || env.controller() !== current.worker) return;
    reconciling = true;
    try {
      await current.save();
      if (intent !== current || disposed || !env.visible() || !current.safe() || env.controller() !== current.worker) return;
      reloaded = true; clear(current); current.resolve(); env.reload();
    } catch (error) { current.reject(error instanceof Error ? error : new Error("Save failed; update restart is deferred")); }
    finally { reconciling = false; }
  };
  const resume = () => { void reconcile(); };
  env.workerEvents.addEventListener("controllerchange", resume);
  env.pageEvents.addEventListener("visibilitychange", resume);

  const apply = async (save: () => Promise<void>, safe: () => boolean) => {
    if (disposed) throw new Error("Update coordinator is closed");
    if (reloaded || requesting) throw new Error("An update restart is already running");
    if (intent) {
      await reconcile();
      if (reloaded) return;
      throw new Error("Update activation is still pending. Restart will wait until this window is visible, idle and saved.");
    }
    requesting = true;
    try {
      if (!safe()) throw new Error("Finish your workout and close editors before updating");
      if (!env.waiting()) throw new Error("No downloaded update is ready yet");
      await save();
      if (disposed || !safe()) throw new Error("Restart deferred; an editor or save is now active");
      // Saving can take time: capture the current waiting worker after it commits.
      const worker = env.waiting();
      if (!worker) throw new Error("The downloaded worker changed while saving. Check updates again.");
      await new Promise<void>((resolve, reject) => {
        const channel = new MessageChannel();
        const current: Intent = {
          worker, save, safe, resolve, reject, channel,
          timer: setTimeout(() => {
            reject(new Error("Update is still applying. This requested restart will wait for a visible, idle, saved window. Closing all windows remains a fallback."));
          }, timeoutMs),
        };
        intent = current;
        channel.port1.onmessage = event => {
          if (event.data?.applied === false && intent === current) {
            clear(current); reject(new Error(event.data.reason ?? "Update was refused by another open window"));
          }
        };
        try { worker.postMessage({ type: "COACH_LOOP_APPLY_UPDATE" }, [channel.port2]); }
        catch (error) { clear(current); reject(error); }
      });
    } finally { requesting = false; }
  };
  return {
    apply,
    hasPending: () => intent !== null,
    dispose: () => {
      disposed = true;
      env.workerEvents.removeEventListener("controllerchange", resume);
      env.pageEvents.removeEventListener("visibilitychange", resume);
      if (intent) { const current = intent; clear(current); current.reject(new Error("Update window closed")); }
    },
  };
}
