import { expect, test } from "@playwright/test";

// v126 regression tests (P1-4): a workout with nothing marked complete cannot
// be finished, and duplicate exercise names warn at entry and in the finish
// dialog.
test("empty workout cannot be finished", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: "Blank workout" }).click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText(/Nothing is marked complete yet/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Finish workout" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("duplicate exercise names warn at entry and in the finish dialog", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: "Blank workout" }).click();
  const names = page.getByLabel("Exercise name");
  await expect(names).toHaveCount(1);
  await names.first().fill("Bench Press");
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await expect(names).toHaveCount(2);
  await names.nth(1).fill("Bench Press");
  await expect(page.getByText(/is already in this workout/)).toBeVisible();
  await page.getByRole("button", { name: "Complete Bench Press, Set 1", exact: true }).first().click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Finish workout" })).toBeVisible();
  await expect(page.getByText(/appears twice/)).toBeVisible();

  expect(pageErrors).toEqual([]);
});
