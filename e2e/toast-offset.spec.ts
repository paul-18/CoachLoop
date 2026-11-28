import { expect, test } from "@playwright/test";

// v126 regression test (P1-5): while the "Last imported plan" bar is showing,
// top toasts must sit below it instead of covering the Undo button.
test("top toasts sit below the Undo-import bar", async ({ page }) => {
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
  await expect(page.getByText("Test QA session")).toBeVisible();
  await expect(page.getByText("Last imported plan")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await page.evaluate(() => {
    const toaster = document.querySelector("[data-sonner-toaster]");
    const bar = document.querySelector(".reliability-bar");
    if (!toaster || !bar) return null;
    return { top: Number.parseFloat(getComputedStyle(toaster).top), barBottom: bar.getBoundingClientRect().bottom };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.top).toBeGreaterThanOrEqual(geometry!.barBottom - 1);

  expect(pageErrors).toEqual([]);
});
