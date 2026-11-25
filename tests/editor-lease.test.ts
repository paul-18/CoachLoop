import test from "node:test";
import assert from "node:assert/strict";
import { acquireEditorLease, leaseAfterFinish } from "../app/pwa/editor-lease";

function lockManager() {
  let active = false;
  return { request: (_name: string, options: LockOptions, callback: LockGrantedCallback<void>) => new Promise<void>((resolve, reject) => {
    if (options.signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    if (options.ifAvailable && active) {
      void Promise.resolve().then(() => callback(null)).then(resolve, reject);
      return;
    }
    if (active) {
      reject(new Error("Unexpected unbounded queue"));
      return;
    }
    active = true;
    const lock = { name: "coach-loop-local-editor", mode: "exclusive" as const };
    void Promise.resolve(callback(lock)).then(() => { active = false; resolve(); }, error => { active = false; reject(error); });
  }) } as unknown as LockManager;
}

test("a second editor fails fast instead of queuing behind a suspended tab", async () => {
  const locks = lockManager();
  const first = acquireEditorLease(locks, () => {});
  const second = acquireEditorLease(locks, () => assert.fail("busy editor must not acquire"));
  await assert.rejects(second.finished, { name: "NotAllowedError" });
  first.dispose();
  await first.finished;
  const retry = acquireEditorLease(locks, () => {});
  retry.dispose();
  await retry.finished;
});

test("disposing a pending lease aborts it and later acquisition remains possible", async () => {
  const locks = lockManager();
  const lease = acquireEditorLease(locks, () => {});
  lease.dispose();
  await lease.finished;
});

test("external browser aborts are interruptions; only disposed leases are ignored", () => {
  assert.equal(leaseAfterFinish("fulfilled", undefined, false), "interrupted");
  assert.equal(leaseAfterFinish("rejected", new DOMException("nope", "InvalidStateError"), false), "interrupted");
  assert.equal(leaseAfterFinish("rejected", new DOMException("Aborted", "AbortError"), false), "interrupted");
  assert.equal(leaseAfterFinish("fulfilled", undefined, true), "ignore");
});

/** WebKit rejects ifAvailable combined with a signal; model that rule. */
function webkitLockManager() {
  let active = false;
  return { request: (_name: string, options: LockOptions, callback: LockGrantedCallback<void>) => new Promise<void>((resolve, reject) => {
    if (options.ifAvailable && options.signal) {
      reject(new DOMException("WebLockOptions's steal and ifAvailable need to be false when a signal is provided", "NotSupportedError"));
      return;
    }
    if (options.ifAvailable && active) {
      void Promise.resolve().then(() => callback(null)).then(resolve, reject);
      return;
    }
    if (active) {
      reject(new Error("Unexpected unbounded queue"));
      return;
    }
    active = true;
    const lock = { name: "coach-loop-local-editor", mode: "exclusive" as const };
    void Promise.resolve(callback(lock)).then(() => { active = false; resolve(); }, error => { active = false; reject(error); });
  }) } as unknown as LockManager;
}

test("lease acquisition works in WebKit: ifAvailable is never combined with a signal", async () => {
  // WebKit/Safari throws NotSupportedError when locks.request() gets
  // ifAvailable:true together with an AbortSignal. That used to reject the
  // very first lease attempt, so the app showed "The editor lock stopped"
  // on every load in Safari and the WebKit smoke test failed.
  const locks = webkitLockManager();
  let owned = false;
  const lease = acquireEditorLease(locks, () => { owned = true; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(owned, true);
  lease.dispose();
  await lease.finished;
});
