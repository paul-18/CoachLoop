import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateCoordinator } from "../app/pwa/update-coordinator";
const pause = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));

test("synchronous postMessage failure rejects and clears intent", async () => {
  const workerEvents = new EventTarget(), pageEvents = new EventTarget();
  const worker = { postMessage() { throw new Error("postMessage failed"); } } as unknown as ServiceWorker;
  const coordinator = createUpdateCoordinator({ workerEvents, pageEvents, waiting: () => worker,
    controller: () => null, visible: () => true, reload() {} }, 50);
  try {
    await assert.rejects(coordinator.apply(async () => {}, () => true), /postMessage failed/);
    assert.equal(coordinator.hasPending(), false);
    await assert.rejects(coordinator.apply(async () => {}, () => true), /postMessage failed/);
  } finally { coordinator.dispose(); }
});

test("timeout clears intent and allows a subsequent apply to post again", async () => {
  const workerEvents = new EventTarget(), pageEvents = new EventTarget();
  let commands = 0;
  const worker = { postMessage() { commands++; } } as unknown as ServiceWorker;
  const coordinator = createUpdateCoordinator({ workerEvents, pageEvents, waiting: () => worker,
    controller: () => null, visible: () => true, reload() {} }, 10);
  try {
    await assert.rejects(coordinator.apply(async () => {}, () => true), /timed out/);
    assert.equal(coordinator.hasPending(), false);
    await assert.rejects(coordinator.apply(async () => {}, () => true), /timed out/);
    assert.equal(commands, 2);
  } finally { coordinator.dispose(); }
});

test("a successful activation saves again and reloads only the requested worker", async () => {
  const workerEvents = new EventTarget(), pageEvents = new EventTarget();
  let controller: ServiceWorker | null = null, saves = 0, reloads = 0;
  const worker = { postMessage() {} } as unknown as ServiceWorker;
  const coordinator = createUpdateCoordinator({ workerEvents, pageEvents, waiting: () => worker,
    controller: () => controller, visible: () => true, reload: () => { reloads++; } }, 100);
  try {
    const request = coordinator.apply(async () => { saves++; }, () => true);
    await pause();
    controller = worker; workerEvents.dispatchEvent(new Event("controllerchange"));
    await request;
    assert.equal(saves, 2);
    assert.equal(reloads, 1);
    assert.equal(coordinator.hasPending(), false);
  } finally { coordinator.dispose(); }
});

test("other-window denial cancels the activation request", async () => {
  const workerEvents = new EventTarget(), pageEvents = new EventTarget();
  let reply: MessagePort | undefined;
  const worker = { postMessage(_message: unknown, transfer?: Transferable[] | StructuredSerializeOptions) {
    reply = (Array.isArray(transfer) ? transfer[0] : transfer?.transfer?.[0]) as MessagePort;
  } } as unknown as ServiceWorker;
  const coordinator = createUpdateCoordinator({ workerEvents, pageEvents, waiting: () => worker,
    controller: () => null, visible: () => true, reload() {} }, 100);
  try {
    const request = coordinator.apply(async () => {}, () => true);
    await pause();
    reply!.postMessage({ applied: false, reason: "Other window" });
    await assert.rejects(request, /Other window/);
    assert.equal(coordinator.hasPending(), false);
  } finally { reply?.close(); coordinator.dispose(); }
});
