import test from "node:test";
import assert from "node:assert/strict";
import { createSyncQueue } from "../app/sync-queue";
import { defaultState } from "../app/training-types";
import { getCloudSnapshot, putCloudSnapshot, SyncError } from "../app/cloud-sync";

test("a reset mismatch stops a stale client upload without merging the cloud state", async () => {
  const original = globalThis.fetch;
  let sent: unknown;
  globalThis.fetch = (async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ code: "DATASET_RESET", error: "This log was reset on another device.", generation: "new-dataset" }, { status: 409 });
  }) as typeof fetch;
  try {
    await assert.rejects(putCloudSnapshot(defaultState(), 4, "legacy"), (error: unknown) => error instanceof SyncError && error.code === "DATASET_RESET");
    assert.equal((sent as { generation: string }).generation, "legacy");
  } finally { globalThis.fetch = original; }
});

test("a cloud read carries the server generation", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ state: defaultState(), revision: 5, updatedAt: "2026-09-27T12:00:00Z", generation: "new-dataset" })) as typeof fetch;
  try { assert.equal((await getCloudSnapshot()).generation, "new-dataset"); }
  finally { globalThis.fetch = original; }
});

test("a reset barrier drains an in-flight sync and discards pending stale writes", async () => {
  let finishPull!: () => void;
  const pullBlocked = new Promise<void>((resolve) => { finishPull = resolve; });
  let pushes = 0;
  const queue = createSyncQueue(() => pullBlocked, async () => { pushes++; }, () => {});
  queue.requestPull();
  queue.requestPush();
  const paused = queue.pauseAndDrain();
  finishPull();
  await paused;
  assert.equal(pushes, 0);
  assert.deepEqual(queue.pending(), { pull: false, push: false });
  queue.requestPush();
  assert.equal(pushes, 0);
  queue.resume();
  queue.requestPush();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(pushes, 1);
});
