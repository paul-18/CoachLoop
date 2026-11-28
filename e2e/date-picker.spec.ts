import { expect, test } from "@playwright/test";

// v126 regression test (P0-1 / D1): clicking a day in a native date picker's
// calendar popup must not dismiss the dialog. The popup lives outside the
// DOM, so the click can arrive as a pointerdown on the document (or as focus
// leaving the input for nowhere) while the date input is focused. Simulate
// that sequence: focus the date input, let focus leave for nowhere (the
// native picker taking over), then dispatch an outside pointerdown. The
// dialog must stay open; a later genuine outside click must still close it.
test("date picker day click does not dismiss the Log bodyweight dialog", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  const navigation = page.locator(".mobile-nav");
  await expect(navigation).toBeVisible();
  await navigation.getByRole("tab", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "Log bodyweight", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Log bodyweight" })).toBeVisible();

  const dateInput = page.getByRole("dialog", { name: "Log bodyweight" }).locator('input[type="date"]');
  await dateInput.click();
  await expect(dateInput).toBeFocused();

  // Simulate the native picker taking focus (focus leaves the input for
  // nowhere) and the day-click arriving as outside pointerdown + click.
  // Radix defers pointer-down-outside dismissal until the click for button 0,
  // so both events are needed for a faithful simulation. Blur the actually
  // focused element: other tabs' panels may hold hidden date inputs earlier
  // in DOM order, so document.querySelector would blur the wrong one.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
  await expect(page.getByRole("dialog", { name: "Log bodyweight" })).toBeVisible();

  // A genuine outside click still closes the dialog: focus a non-date field
  // first (so the picker guard clears), then click the overlay.
  await page.getByRole("textbox", { name: "Weight", exact: true }).click();
  await page.mouse.click(20, 20);
  await expect(page.getByRole("dialog", { name: "Log bodyweight" })).toBeHidden();

  expect(pageErrors).toEqual([]);
});
