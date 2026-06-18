import { expect, test } from "@playwright/test";

test("activity page filters and reports stream connection state", async ({ page }) => {
  await page.goto("/repositories/00112233445566778899aabbccddeeff/activity");

  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Event filter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Notification stream");

  await page.getByRole("textbox", { name: "Event filter" }).fill("branch.created");
  await page.getByRole("button", { name: "Connect stream" }).click();
  await expect(page.getByRole("status")).toContainText(/connected|unavailable/);

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("status")).toContainText("Reconnect state: idle");
});
