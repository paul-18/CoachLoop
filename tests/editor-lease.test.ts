import test from "node:test";
import assert from "node:assert/strict";
import { acquireEditorLease, leaseAfterFinish } from "../app/pwa/editor-lease";

function lockManager() {
  let active = false;
  const queue: Array<() => void> = [];
  const advance = () => { if (!active) queue.shift()?.(); };
  return { request: (_name: string, options: LockOptions, callback: LockGrantedCallback<void>) => new Promise<void>((resolve, reject) => {
    let started = false;
    const run = () => {
      if (options.signal?.aborted) return;
      started = true; active = true;
      void Promise.resolve(callback({ name: "coach-loop-local-editor", mode: "exclusive" })).then(() => {
        active = false; resolve(); advance();
      }, reject);
    };
    options.signal?.addEventListener("abort", () => {
      if (started) return;
      const index = queue.indexOf(run);
      if (index >= 0) queue.splice(index, 1);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
    queue.push(run); advance();
  }) } as unknown as LockManager;
}

test("second editor waits and acquires automatically after the first releases", async () => {
  const locks = lockManager();
  const owners: string[] = [];
  const first = acquireEditorLease(locks, () => owners.push("first"));
  const second = acquireEditorLease(locks, () => owners.push("second"));
  assert.deepEqual(owners, ["first"]);
  first.dispose();
  await first.finished;
  assert.deepEqual(owners, ["first", "second"]);
  second.dispose(); await second.finished;
});

test("closing a waiting editor cancels its request without blocking a later editor", async () => {
  const locks = lockManager();
  const first = acquireEditorLease(locks, () => {});
  const cancelled = acquireEditorLease(locks, () => assert.fail("closed editor acquired"));
  const rejected = assert.rejects(cancelled.finished, { name: "AbortError" });
  cancelled.dispose(); await rejected;
  let opened = false;
  const next = acquireEditorLease(locks, () => { opened = true; });
  first.dispose(); await first.finished;
  assert.equal(opened, true);
  next.dispose(); await next.finished;
});

test("a lock that ends on its own is an interruption, while our own abort is ignored", () => {
  assert.equal(leaseAfterFinish("fulfilled", undefined, false), "interrupted");
  assert.equal(leaseAfterFinish("rejected", new DOMException("nope", "InvalidStateError"), false), "interrupted");
  assert.equal(leaseAfterFinish("rejected", new DOMException("Aborted", "AbortError"), false), "ignore");
  assert.equal(leaseAfterFinish("fulfilled", undefined, true), "ignore");
});
