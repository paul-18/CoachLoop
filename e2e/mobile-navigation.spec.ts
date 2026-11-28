import { expect, test } from "@playwright/test";
import { makeSeedState, makeSeedWorkout, seedTrainingState } from "./helpers/seed-training-state";

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

test("Bottom tabs hide while a blank workout is open; leaving via Back shows the Workout in progress card", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  // Bottom tabs are visible on the home screen
  const navigation = page.locator(".mobile-nav");
  await expect(navigation).toBeVisible();

  // Start blank workout from fresh empty profile
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: /Blank workout/ }).click();
  await expect(page.locator(".workout-header")).toBeVisible();

  // No bottom bar during a live workout
  await expect(navigation).toBeHidden();

  // Leave via the workout header's Back button; the workout stays active
  await page.getByRole("button", { name: "Back to today", exact: true }).click();
  await expect(page.locator(".active-workout-card")).toBeVisible();
  await expect(page.getByText(/Workout in progress/i)).toBeVisible();
  await expect(page.locator(".active-workout-card")).toContainText("Resume");

  // Tabs are back once the workout is closed, and switching works
  await expect(navigation).toBeVisible();
  for (const name of ["History", "Coach", "Progress", "Settings", "Today"]) {
    const tab = navigation.getByRole("tab", { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(`#panel-${name.toLowerCase()}`)).toHaveAttribute("data-state", "active");
  }

  expect(pageErrors).toEqual([]);
});

test("History edit back arrow returns to History with URL and scroll position restored", async ({ page }) => {
  const targetName = "History edit back arrow fixture";
  await page.goto("/");
  const state = makeSeedState(Array.from({ length: 35 }, (_, index) =>
    makeSeedWorkout(index === 18 ? targetName : `History scroll fixture ${index}`, index)
  ));
  await seedTrainingState(page, state);
  await page.reload();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  const card = page.locator(".history-card").filter({ hasText: targetName }).first();
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button").first().click();
  const editButton = card.getByRole("button", { name: "Edit", exact: true });
  await expect(editButton).toBeVisible();
  await editButton.scrollIntoViewIfNeeded();
  await editButton.evaluate((button) => {
    button.addEventListener("click", () => {
      (window as Window & { __historyEditScroll?: number }).__historyEditScroll = window.scrollY;
    }, { once: true });
  });
  await editButton.click();
  const savedScroll = await page.evaluate(() =>
    (window as Window & { __historyEditScroll?: number }).__historyEditScroll ?? window.scrollY
  );
  await expect(page.locator(".workout-header")).toBeVisible();
  // v126 P1-3: editing from History relabels the button "Back to History".
  await page.getByRole("button", { name: "Back to History", exact: true }).click();
  await expect(page.getByRole("tab", { name: "History", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get("view"))).toBe("history");
  await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - savedScroll)).toBeLessThanOrEqual(2);
});
