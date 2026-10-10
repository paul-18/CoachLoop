import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  notificationPermissionState,
  requestNotificationPermission,
  notifyRestComplete,
} from "../app/pwa/use-local-notifications";

const g = globalThis as Record<string, unknown>;

function resetGlobals() {
  delete g.window;
  delete g.Notification;
  delete g.document;
  delete g.navigator;
}

function installNotificationStub(permission: string, requestResult?: string) {
  const calls: Array<{ title: string; options?: Record<string, unknown> }> = [];
  const Ctor = function (this: unknown, title: string, options?: Record<string, unknown>) {
    calls.push({ title, options });
  } as unknown as { new (title: string, options?: Record<string, unknown>): unknown; permission: string; requestPermission: () => Promise<string> };
  Ctor.permission = permission;
  Ctor.requestPermission = async () => requestResult ?? permission;
  g.window = g;
  g.Notification = Ctor;
  g.document = { visibilityState: "hidden" };
  g.navigator = {};
  return calls;
}

test("reports unsupported when the Notification API is absent", () => {
  resetGlobals();
  assert.equal(notificationPermissionState(), "unsupported");
});

test("reports the current permission without prompting", () => {
  resetGlobals();
  installNotificationStub("denied");
  assert.equal(notificationPermissionState(), "denied");
  resetGlobals();
});

test("requestPermission resolves with the user's choice", async () => {
  resetGlobals();
  installNotificationStub("default", "granted");
  assert.equal(await requestNotificationPermission(), "granted");
  resetGlobals();
  assert.equal(await requestNotificationPermission(), "unsupported");
});

test("notifyRestComplete stays silent unless permission is granted", async () => {
  resetGlobals();
  const calls = installNotificationStub("denied");
  assert.equal(await notifyRestComplete("Bench Press"), false);
  assert.equal(calls.length, 0);
  resetGlobals();
});

test("notifyRestComplete stays silent while the app is visible", async () => {
  resetGlobals();
  const calls = installNotificationStub("granted");
  (g.document as { visibilityState: string }).visibilityState = "visible";
  assert.equal(await notifyRestComplete("Bench Press"), false);
  assert.equal(calls.length, 0);
  resetGlobals();
});

test("notifyRestComplete shows a tagged silent page notification when no service worker is active", async () => {
  resetGlobals();
  const calls = installNotificationStub("granted");
  assert.equal(await notifyRestComplete("Bench Press"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].title, "Rest over");
  assert.deepEqual(calls[0].options, { body: "Next: Bench Press", tag: "coach-loop-rest", silent: true });
  resetGlobals();
});

test("notifyRestComplete falls back to a generic body without a next label", async () => {
  resetGlobals();
  const calls = installNotificationStub("granted");
  assert.equal(await notifyRestComplete(""), true);
  assert.equal(calls[0].options?.body, "Time for your next set");
  resetGlobals();
});

test("notifyRestComplete prefers the service worker registration so taps focus the app", async () => {
  resetGlobals();
  const shown: Array<{ title: string; options?: Record<string, unknown> }> = [];
  const calls = installNotificationStub("granted");
  (g.navigator as Record<string, unknown>).serviceWorker = {
    ready: Promise.resolve({
      showNotification: async (title: string, options?: Record<string, unknown>) => { shown.push({ title, options }); },
    }),
  };
  assert.equal(await notifyRestComplete("Squat"), true);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Rest over");
  assert.deepEqual(shown[0].options, { body: "Next: Squat", tag: "coach-loop-rest", silent: true });
  assert.equal(calls.length, 0);
  resetGlobals();
});

test("notifyRestComplete returns false when showing throws", async () => {
  resetGlobals();
  installNotificationStub("granted");
  (g.navigator as Record<string, unknown>).serviceWorker = {
    ready: Promise.reject(new Error("no worker")),
  };
  assert.equal(await notifyRestComplete("Squat"), false);
  resetGlobals();
});

test("generated service worker focuses the app when a notification is tapped", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const template = readFileSync(join(here, "..", "scripts", "build-pwa.mjs"), "utf8");
  assert.ok(template.includes('addEventListener("notificationclick"'), "worker template handles notification taps");
  assert.ok(template.includes("clients.matchAll"), "tap handler looks for the open app window");
});
