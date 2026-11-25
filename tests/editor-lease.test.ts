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
    const lock = { name: "coach-loop-local-editor", mode: "exclusive" };
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
