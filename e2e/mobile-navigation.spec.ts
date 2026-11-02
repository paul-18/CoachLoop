import { expect, test } from "@playwright/test";

test("WebKit iPhone viewport keeps the bottom tabs usable through repeated navigation and zero horizontal overflow", async ({ page }) => {
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  for (let round = 0; round < 3; round += 1) {
    for (const name of ["History", "Coach", "Progress", "Settings", "Today"]) {
      const tab = navigation.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(`#panel-${name.toLowerCase()}`)).toHaveAttribute("data-state", "active");
      await expect(page.getByText("Opening view…")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }

  expect(pageErrors).toEqual([]);
});

test("Blank workout workflow: rename, complete sets, mark incomplete, and unskip at 390x844 phone viewport", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  // Start blank workout
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: /Blank workout/ }).click();
  const workoutHeader = page.locator(".workout-header");
  await expect(workoutHeader).toBeVisible();

  // Rename "New exercise" to "Bench Press"
  const nameInput = page.getByRole("textbox", { name: "Exercise name" });
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Bench Press");
  await nameInput.blur();

  // Enter reps on sets to make them completable
  const repsInputs = page.locator('input[id^="reps-"]');
  await repsInputs.nth(0).fill("5");
  await repsInputs.nth(1).fill("5");
  await repsInputs.nth(2).fill("5");

  // Complete all 3 sets
  const checkButtons = page.locator("button.set-check");
  await checkButtons.nth(0).click();
  await checkButtons.nth(1).click();
  await checkButtons.nth(2).click();

  // Review & Mark incomplete on Set 3
  const reviewBtn = page.getByRole("button", { name: /Review Bench Press/ });
  await expect(reviewBtn).toBeVisible();
  await reviewBtn.click();

  const set3Incomplete = page.getByRole("button", { name: "Mark Bench Press, Set 3 incomplete" });
  await expect(set3Incomplete).toBeVisible();
  await set3Incomplete.click();

  // Assert header shows 2/3
  const headerProgress = page.locator(".workout-header-title p");
  await expect(headerProgress).toContainText("2/3 sets");

  // Assert rest bar does NOT say "All work complete"
  const restNext = page.locator(".rest-next");
  if (await restNext.isVisible()) {
    await expect(restNext).not.toContainText("All work complete");
  }

  // Skip Set 1 via menu
  const set1Options = page.getByRole("button", { name: /Options for Bench Press, Set 1/ });
  await set1Options.click();
  const skipItem = page.getByRole("menuitem", { name: "Skip this set" });
  await skipItem.click();

  // Assert header and card counts reflect skipped set
  await expect(headerProgress).toContainText("1 skipped");

  // Click Unskip
  const unskipBtn = page.getByRole("button", { name: /Unskip Bench Press, Set 1/ });
  await expect(unskipBtn).toBeVisible();
  await unskipBtn.click();

  // Assert set returns directly to pending (0 done for set 1)
  await expect(checkButtons.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect(checkButtons.nth(0)).toHaveAttribute("aria-label", /Complete Bench Press, Set 1/);

  expect(pageErrors).toEqual([]);
});

test("Primary tab switching while blank workout is open collapses into WORKOUT IN PROGRESS and switches tabs cleanly", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  // Start blank workout from fresh empty profile
  const navigation = page.locator(".mobile-nav");
  await expect(navigation).toBeVisible();

  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: /Blank workout/ }).click();
  await expect(page.locator(".workout-header")).toBeVisible();

  // Click through History -> Coach -> Progress -> Settings -> Today while workout is open
  for (const name of ["History", "Coach", "Progress", "Settings", "Today"]) {
    const tab = navigation.getByRole("tab", { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(`#panel-${name.toLowerCase()}`)).toHaveAttribute("data-state", "active");
  }

  // Returning to Today shows the Workout in progress card
  await expect(page.locator(".active-workout-card")).toBeVisible();
  await expect(page.getByText(/Workout in progress/i)).toBeVisible();
  await expect(page.locator(".active-workout-card")).toContainText("Resume");

  expect(pageErrors).toEqual([]);
});
