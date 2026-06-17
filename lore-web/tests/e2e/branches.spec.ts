import { expect, test } from "@playwright/test";

test("branches page exposes filters, create, delete, and push controls", async ({ page }) => {
  await page.goto("/repositories/00112233445566778899aabbccddeeff/branches");

  await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Include deleted branches" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Creator filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create branch" })).toBeVisible();
  await expect(page.getByText("Delete confirmation")).toBeVisible();
  await expect(page.getByText("Push revision")).toBeVisible();
});
