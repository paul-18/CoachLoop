import { expect, test } from "@playwright/test";

test("WebKit iPhone viewport keeps the bottom tabs usable through repeated navigation", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  const navigation = page.locator(".mobile-nav");
  await expect(navigation).toBeVisible();

  const bounds = await navigation.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  expect(await page.locator(".app-main").evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom))).toBeGreaterThanOrEqual(67);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  for (let round = 0; round < 3; round += 1) {
    for (const name of ["History", "Coach", "Progress", "Settings", "Today"]) {
      const tab = navigation.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(`#panel-${name.toLowerCase()}`)).toHaveAttribute("data-state", "active");
      await expect(page.getByText("Opening view…")).toHaveCount(0);
    }
  }

  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add segment" })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
