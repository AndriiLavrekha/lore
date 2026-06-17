import { expect, test } from "@playwright/test";

test("repositories page exposes table, filter, create, and delete controls", async ({ page }) => {
  await page.goto("/repositories");

  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Filter repositories" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create repository" })).toBeVisible();
  await expect(page.getByText("Repository id")).toBeVisible();
  await expect(page.getByText("Delete confirmation")).toBeVisible();
});
