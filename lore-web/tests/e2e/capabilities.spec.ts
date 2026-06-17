import { expect, test } from "@playwright/test";

test("overview and settings render capability-oriented fields", async ({ page }) => {
  await page.goto("/overview");

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Auth state")).toBeVisible();
  await expect(page.getByText("Repository list")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("LORE_WEB_NOTIFICATION_STREAM")).toBeVisible();
});
