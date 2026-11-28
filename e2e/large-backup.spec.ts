import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// v126 regression test (P1-6): a backup over the 10 MB large-file line parses in
// a worker — the restore review opens and the page stays usable.
test("large backup restores through the worker", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?view=settings");
  await expect(page.getByRole("button", { name: "Download full backup" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full backup" }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const raw = JSON.parse(readFileSync(downloadedPath!, "utf8")) as Record<string, unknown>;
  raw.coachProfile = "x".repeat(11_000_000);
  const dir = mkdtempSync(join(tmpdir(), "coach-loop-large-backup-"));
  const largePath = join(dir, "large-backup.json");
  writeFileSync(largePath, JSON.stringify(raw));

  await page.locator('input[type="file"]:not([aria-label])').setInputFiles(largePath);
  await expect(page.getByRole("dialog", { name: "Review backup restore" })).toBeVisible({ timeout: 30000 });
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(resources.some((name) => name.includes("backup-worker"))).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Review backup restore" })).toBeHidden();

  expect(pageErrors).toEqual([]);
});
