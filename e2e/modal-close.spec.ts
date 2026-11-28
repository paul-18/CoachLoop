import { expect, test } from "@playwright/test";

// v126 regression tests (P0-2, P0-3, P0-4): modal dismissal. The × close
// button must close every modal (on an installed iPhone PWA there is no
// Escape key), opening a HYROX session must close the setup modal, and
// saving a FITLOG import for later must close the import modal with the plan
// on Today.
test("× closes the HYROX gym simulation modal", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: "HYROX simulation" }).click();
  await expect(page.getByRole("dialog", { name: "HYROX gym simulation" })).toBeVisible();
  await page.getByRole("dialog", { name: "HYROX gym simulation" }).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "HYROX gym simulation" })).toBeHidden();

  expect(pageErrors).toEqual([]);
});

test("× closes the Build your coach brief modal", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: "Ask your AI chat" }).click();
  await expect(page.getByRole("dialog", { name: "Build your coach brief" })).toBeVisible();
  await page.getByRole("dialog", { name: "Build your coach brief" }).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Build your coach brief" })).toBeHidden();

  expect(pageErrors).toEqual([]);
});

test("HYROX Open session closes the setup modal and shows the live session", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: "HYROX simulation" }).click();
  await expect(page.getByRole("dialog", { name: "HYROX gym simulation" })).toBeVisible();
  await page.getByRole("button", { name: "Open session", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "HYROX gym simulation" })).toBeHidden();
  await expect(page.getByRole("button", { name: "End session early", exact: true })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("FITLOG Save for later closes the import modal and puts the plan on Today", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: /Import workout/ }).click();
  await expect(page.getByText("Bring a workout in")).toBeVisible();
  await page.getByLabel("FITLOG workout text").fill(
    "[FITLOG:3]\nWORKOUT|Test QA session|2026-11-27\nEXERCISE|Barbell Bench Press\nSET|8|100 kg total|RPE 8\nSET|8|100 kg total|RPE 8\nCARDIO|Easy run\nTYPE|run\nMODE|summary\nDURATION|20\n[/FITLOG]",
  );
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await expect(page.getByText("Ready to import")).toBeVisible();
  await page.getByRole("button", { name: "Save for later", exact: true }).click();
  await expect(page.getByText("Bring a workout in")).toBeHidden();
  await expect(page.getByText("Test QA session")).toBeVisible();

  expect(pageErrors).toEqual([]);
});
