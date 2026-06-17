import { expect, test } from "@playwright/test";

test("branch page exposes protection indicator and action", async ({ page }) => {
  await page.goto("/repositories/00112233445566778899aabbccddeeff/branches");

  await expect(page.getByRole("heading", { name: "Protection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Protect branch", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unprotect branch" })).toBeVisible();
});
