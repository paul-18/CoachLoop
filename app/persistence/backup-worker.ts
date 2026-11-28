import { parseBackupReview } from "./backup-tools";

/** Runs the backup parse off the main thread so a large file cannot freeze the page. */
type WorkerScope = {
  onmessage: ((event: MessageEvent<{ buffer: ArrayBuffer }>) => void) | null;
  postMessage: (message: unknown) => void;
};

const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
  try {
    const text = new TextDecoder().decode(event.data.buffer);
    const review = parseBackupReview(text);
    scope.postMessage({ ok: true, review });
  } catch (error) {
    scope.postMessage({ ok: false, message: error instanceof Error ? error.message : "That file is not a valid Coach Loop backup" });
  }
};
