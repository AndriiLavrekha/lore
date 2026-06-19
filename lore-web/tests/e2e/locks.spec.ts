import { expect, test } from "@playwright/test";

const repoId = "00112233445566778899aabbccddeeff";
const branchId = "11112222333344445555666677778888";
const lock = {
  branch: branchId,
  hash: "0".repeat(64),
  description: "/README.md",
  owner: "operator",
  lockedAt: "2026-06-18T00:00:00.000Z",
};

test("locks page queries, acquires, and releases locks", async ({ page }) => {
  let queryCount = 0;
  await page.route(`**/api/repositories/${repoId}/locks**`, async (route) => {
    if (route.request().method() === "GET") {
      queryCount += 1;
      await route.fulfill({ json: { items: queryCount > 1 ? [lock] : [] } });
      return;
    }
    await route.fulfill({ json: { items: [lock] } });
  });

  await page.goto(`/repositories/${repoId}/locks`);

  await expect(page.getByRole("heading", { name: "Locks" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("No locks matched");

  await page.getByRole("textbox", { name: "Branch filter" }).fill(branchId);
  await page.getByRole("textbox", { name: "Path filter" }).fill(lock.description);
  await page.getByRole("button", { name: "Acquire lock" }).click();
  await expect(page.getByRole("status")).toContainText("Lock acquire requested.");
  await expect(page.getByRole("row", { name: /README/ })).toBeVisible();

  await page.getByRole("button", { name: "Release lock" }).click();
  await expect(page.getByRole("status")).toContainText("Lock release requested.");
});
