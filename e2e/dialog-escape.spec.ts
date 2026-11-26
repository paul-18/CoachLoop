import { expect, test } from "@playwright/test";

// v124 regression test: Escape must close "Bring a workout in" even with the
// FITLOG textarea focused. Radix handles Escape at the document level, so a
// focused textarea must not swallow it (v123 fixed this via onEscapeKeyDown;
// this test pins it).
test("Escape closes Bring a workout in with the FITLOG textarea focused", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: /Import workout/ }).click();
  await expect(page.getByText("Bring a workout in")).toBeVisible();

  const textarea = page.getByLabel("FITLOG workout text");
  await textarea.click();
  await expect(textarea).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Bring a workout in")).toBeHidden();

  expect(pageErrors).toEqual([]);
});
