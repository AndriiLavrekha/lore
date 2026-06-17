import { expect, test } from "@playwright/test";

test("history page exposes revision list, cursor, tree, and diff panels", async ({ page }) => {
  await page.goto(
    "/repositories/00112233445566778899aabbccddeeff/branches/ffeeddccbbaa99887766554433221100/history",
  );

  await expect(page.getByRole("heading", { name: "Revision history" })).toBeVisible();
  await expect(page.getByText("Forward cursor")).toBeVisible();
  await expect(page.getByText("Tree panel")).toBeVisible();
  await expect(page.getByText("Diff panel")).toBeVisible();
});
