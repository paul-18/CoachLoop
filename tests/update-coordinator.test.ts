import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateCoordinator } from "../app/pwa/update-coordinator";
const pause = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
test("late failed flush reports persistent restart feedback after the request timed out", async () => {
  const workerEvents = new EventTarget(), pageEvents = new EventTarget();
  let controller: ServiceWorker | null = null, saves = 0, reloads = 0, message = "";
  const worker = { postMessage() {} } as unknown as ServiceWorker;
  const coordinator = createUpdateCoordinator({ workerEvents, pageEvents,
    waiting: () => worker, controller: () => controller, visible: () => true,
    reload: () => { reloads++; }, onStatus: value => { message = value; } }, 15);
  const save = async () => { if (++saves === 2) throw new Error("Quota"); };
  try {
    await assert.rejects(coordinator.apply(save, () => true), /still applying/);
    assert.match(message, /activation is still pending/);
    controller = worker; workerEvents.dispatchEvent(new Event("controllerchange")); await pause();
    assert.equal(reloads, 0); assert.match(message, /could not be saved/);
    assert.equal(coordinator.hasPending(), true);
    pageEvents.dispatchEvent(new Event("visibilitychange")); await pause();
    assert.equal(reloads, 1); assert.equal(message, "");
  } finally { coordinator.dispose(); }
});
function setup(timeout = 20) {
  const workerEvents = new EventTarget(), pageEvents = new EventTarget();
  let current: ServiceWorker | null = null, visible = true, safe = true, reloads = 0, saves = 0, commands = 0;
  const worker = { postMessage: () => { commands++; } } as unknown as ServiceWorker;
  let waiting: ServiceWorker | null = worker;
  const coordinator = createUpdateCoordinator({ workerEvents, pageEvents, waiting: () => waiting, controller: () => current, visible: () => visible, reload: () => { reloads++; } }, timeout);
  return { worker, coordinator, workerEvents, pageEvents, get reloads() { return reloads; }, get commands() { return commands; }, get saves() { return saves; },
    save: async () => { saves++; }, safe: () => safe,
    setSafe: (value: boolean) => { safe = value; }, setVisible: (value: boolean) => { visible = value; pageEvents.dispatchEvent(new Event("visibilitychange")); },
    setWaiting: (value: ServiceWorker | null) => { waiting = value; }, activate: (value = worker) => { current = value; workerEvents.dispatchEvent(new Event("controllerchange")); } };
}

test("late target activation survives timeout/background; requires idle and second durable flush", async () => {
  const s = setup();
  try {
    const request = s.coordinator.apply(s.save, s.safe);
    const timeout = assert.rejects(request, /still applying/);
    await pause(); s.setVisible(false); await timeout;
    assert.equal(s.coordinator.hasPending(), true, "Settings can still offer the requested restart after timeout");
    s.activate(); await pause(); assert.equal(s.reloads, 0);
    s.setSafe(false); s.setVisible(true); await pause(); assert.equal(s.reloads, 0, "open editor prevents a late restart");
    s.setSafe(true); s.setVisible(true); await pause();
    assert.equal(s.reloads, 1); assert.equal(s.saves, 2);
    assert.equal(s.coordinator.hasPending(), false);
    s.activate(); s.setVisible(true); await pause(); assert.equal(s.reloads, 1);
  } finally { s.coordinator.dispose(); }
});

test("unrelated controller never reloads; target restart save failure retains intent for retry", async () => {
  const s = setup(); let failed = false, saves = 0;
  const save = async () => { saves++; if (saves > 1 && !failed) { failed = true; throw new Error("Late quota failure"); } };
  try {
    const request = s.coordinator.apply(save, s.safe);
    const timedOut = assert.rejects(request, /still applying/);
    await pause(); s.activate({ postMessage() {} } as unknown as ServiceWorker);
    await timedOut; assert.equal(s.reloads, 0);
    s.activate(); await pause(); assert.equal(s.reloads, 0, "failed late flush cannot restart");
    s.setVisible(true); await pause(); assert.equal(s.reloads, 1); assert.equal(saves, 3);
  } finally { s.coordinator.dispose(); }
});

test("capture waiting worker after save; blocked or failed initial save sends no command", async () => {
  const s = setup(100); let secondCommands = 0;
  const replacement = { postMessage() { secondCommands++; } } as unknown as ServiceWorker;
  try {
    s.setSafe(false); await assert.rejects(s.coordinator.apply(s.save, s.safe), /close editors/);
    s.setSafe(true); await assert.rejects(s.coordinator.apply(async () => { throw new Error("Quota"); }, s.safe), /Quota/);
    assert.equal(s.commands, 0);
    const request = s.coordinator.apply(async () => { s.setWaiting(replacement); }, s.safe);
    await pause(); assert.equal(s.commands, 0); assert.equal(secondCommands, 1);
    s.activate(replacement); await request; assert.equal(s.reloads, 1);
  } finally { s.coordinator.dispose(); }
});

test("other-window denial cancels even after timeout and cannot cause a later reload", async () => {
  const s = setup(); let reply: MessagePort | undefined;
  s.worker.postMessage = (_message: unknown, transfer?: Transferable[] | StructuredSerializeOptions) => { reply = (Array.isArray(transfer) ? transfer[0] : transfer?.transfer?.[0]) as MessagePort; };
  try {
    await assert.rejects(s.coordinator.apply(s.save, s.safe), /still applying/);
    reply!.postMessage({ applied: false, reason: "Other window" }); await pause();
    s.activate(); await pause(); assert.equal(s.reloads, 0);
  } finally { reply?.close(); s.coordinator.dispose(); }
});
