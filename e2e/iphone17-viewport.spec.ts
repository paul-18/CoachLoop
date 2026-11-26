import { expect, test } from "@playwright/test";

// iPhone 17 standalone-PWA viewport: 402x874 (screen height; the installed
// PWA has no Safari chrome, so the viewport approaches the screen height).
// Covers the v124 prompt's four checks plus the RestTimer alignment fix.

const expectNoHorizontalOverflow = async (page: import("@playwright/test").Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
};

test("iPhone 17 viewport: no overflow across views, rest timer aligned, Finish reachable, inputs 16px, Strength subtitle unclipped", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start blank", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await expect(page.getByRole("button", { name: /Blank workout/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const navigation = page.locator(".mobile-nav");
  for (const name of ["History", "Coach", "Progress", "Settings", "Today"]) {
    const tab = navigation.getByRole("tab", { name, exact: true });
    await tab.click();
    await expect(page.locator(`#panel-${name.toLowerCase()}`)).toHaveAttribute("data-state", "active");
    await expectNoHorizontalOverflow(page);
  }

  // Active workout with the rest timer running.
  await page.getByRole("button", { name: /Blank workout/ }).click();
  await expect(page.locator(".workout-header")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const repsInputs = page.locator('input[id^="reps-"]');
  // A load is required: the Progress Strength card counts loaded sets only,
  // so a bodyweight-only set leaves the card off entirely.
  await page.getByLabel(/actual weight in/).first().fill("100");
  await repsInputs.nth(0).fill("5");
  await page.locator("button.set-check").nth(0).click();
  const restTimer = page.locator(".rest-timer");
  await expect(restTimer).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // RestTimer text aligns with the first exercise card; Skip aligns with the
  // card's right edge (the v124 inner-container fix).
  const alignment = await page.evaluate(() => {
    const timerText = document.querySelector(".rest-timer-copy")!.getBoundingClientRect();
    const card = document.querySelector(".exercise-card")!.getBoundingClientRect();
    const skip = document.querySelector(".rest-timer button")!.getBoundingClientRect();
    return { timerLeft: timerText.left, cardLeft: card.left, skipRight: skip.right, cardRight: card.right };
  });
  expect(Math.abs(alignment.timerLeft - alignment.cardLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(alignment.skipRight - alignment.cardRight)).toBeLessThanOrEqual(2);

  // Set inputs must be 16px or larger (no iOS zoom on focus).
  const fontSizes = await page.locator(".set-input input").evaluateAll((inputs) => inputs.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  expect(fontSizes.length).toBeGreaterThan(0);
  for (const size of fontSizes) expect(size).toBeGreaterThanOrEqual(16);

  // The bottom Finish button must be clickable while a set input is focused
  // and the rest timer is active.
  await repsInputs.nth(1).click();
  await expect(repsInputs.nth(1)).toBeFocused();
  const finish = page.getByRole("button", { name: "Finish workout", exact: true });
  await finish.scrollIntoViewIfNeeded();
  await expect(finish).toBeVisible();
  const box = await finish.boundingBox();
  expect(box).not.toBeNull();
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.includes("Finish workout") ?? false, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
  expect(hit).toBe(true);
  await finish.click();
  const finishDialog = page.getByRole("alertdialog");
  await expect(finishDialog).toBeVisible();
  await finishDialog.getByRole("button", { name: /Finish workout|Save unusual entry/ }).click();
  await expect(page.locator(".workout-header")).toBeHidden();

  // Progress: the Strength subtitle must not clip at 402px, and the fix
  // (wrapping, not ellipsis) must be in effect.
  const progressTab = navigation.getByRole("tab", { name: "Progress", exact: true });
  await progressTab.click();
  await expect(page.locator("#panel-progress")).toHaveAttribute("data-state", "active");
  await expectNoHorizontalOverflow(page);
  const subtitle = page.locator(".activity-summary-text small").first();
  await expect(subtitle).toBeVisible();
  const subtitleBox = await subtitle.evaluate((el) => {
    const style = getComputedStyle(el);
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, whiteSpace: style.whiteSpace, textOverflow: style.textOverflow };
  });
  expect(subtitleBox.whiteSpace).not.toBe("nowrap");
  expect(subtitleBox.textOverflow).not.toBe("ellipsis");
  expect(subtitleBox.scrollWidth).toBeLessThanOrEqual(subtitleBox.clientWidth);

  expect(pageErrors).toEqual([]);
});

test("RestTimer aligns with the exercise column at desktop width too", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/");
  await page.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByRole("button", { name: /Blank workout/ }).click();
  await expect(page.locator(".workout-header")).toBeVisible();
  const repsInputs = page.locator('input[id^="reps-"]');
  await repsInputs.nth(0).fill("5");
  await page.locator("button.set-check").nth(0).click();
  await expect(page.locator(".rest-timer")).toBeVisible();

  const alignment = await page.evaluate(() => {
    const timerText = document.querySelector(".rest-timer-copy")!.getBoundingClientRect();
    const card = document.querySelector(".exercise-card")!.getBoundingClientRect();
    const skip = document.querySelector(".rest-timer button")!.getBoundingClientRect();
    return { timerLeft: timerText.left, cardLeft: card.left, skipRight: skip.right, cardRight: card.right };
  });
  expect(Math.abs(alignment.timerLeft - alignment.cardLeft)).toBeLessThanOrEqual(2);
  expect(Math.abs(alignment.skipRight - alignment.cardRight)).toBeLessThanOrEqual(2);

  expect(pageErrors).toEqual([]);
});
