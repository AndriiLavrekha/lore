import { expect, test } from "@playwright/test";

test("activity page exposes unavailable state, filters, and timeline", async ({ page }) => {
  await page.goto("/repositories/00112233445566778899aabbccddeeff/activity");

  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Event filter" })).toBeVisible();
  await expect(page.getByText("Timeline")).toBeVisible();
  await expect(page.getByText("Notification stream: configure")).toBeVisible();
});
