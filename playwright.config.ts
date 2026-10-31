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
  projects: [{ name: "webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } }],
  webServer: {
    command: "node_modules/.bin/vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/CoachLoop/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
