import { expect, test } from "@playwright/test";

test("locks page exposes filters and lock actions", async ({ page }) => {
  await page.goto("/repositories/00112233445566778899aabbccddeeff/locks");

  await expect(page.getByRole("heading", { name: "Locks" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Branch filter" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Owner filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acquire lock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Admin lock" })).toBeVisible();
});
