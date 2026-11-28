import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  timeout: 30_000,
  use: {
    ...devices["iPhone 13"],
    baseURL: "http://127.0.0.1:4173",
    browserName: "webkit",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "webkit",
      testMatch: ["**/mobile-navigation.spec.ts", "**/dialog-escape.spec.ts", "**/date-picker.spec.ts", "**/modal-close.spec.ts", "**/finish-empty.spec.ts", "**/toast-offset.spec.ts", "**/large-backup.spec.ts"],
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    {
      name: "webkit-iphone17",
      // iPhone 17 standalone PWA: the installed app has no Safari chrome, so
      // the viewport approaches the 402x874 screen size (the preset's own
      // viewport is 402x681 for in-browser Safari).
      testMatch: ["**/iphone17-viewport.spec.ts"],
      use: { ...devices["iPhone 17"], viewport: { width: 402, height: 874 }, browserName: "webkit" },
    },
  ],
  webServer: {
    command: "node_modules/.bin/vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
