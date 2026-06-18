import { expect, test } from "@playwright/test";

const repoId = "00112233445566778899aabbccddeeff";
const branchId = "ffeeddccbbaa99887766554433221100";
const signature = "1".repeat(64);
const revision = {
  number: "1",
  signature,
  metadata: "2".repeat(64),
  state: "3".repeat(64),
};

test("history page loads revisions and opens info, tree, and diff panels", async ({ page }) => {
  await page.route(`**/api/repositories/${repoId}/revisions?**`, async (route) => {
    await route.fulfill({
      json: { items: [revision], signatureForward: "4".repeat(64), signatureBackward: "" },
    });
  });
  await page.route(`**/api/repositories/${repoId}/revisions/${signature}?view=info`, async (route) => {
    await route.fulfill({ json: { signature, author: "operator" } });
  });
  await page.route(`**/api/repositories/${repoId}/revisions/${signature}?view=tree`, async (route) => {
    await route.fulfill({ json: { items: [{ path: "/README.md" }], truncated: false } });
  });
  await page.route(`**/api/repositories/${repoId}/revisions/${signature}?view=diff`, async (route) => {
    await route.fulfill({ json: { items: [{ path: "/README.md", status: "modified" }], truncated: false } });
  });

  await page.goto(`/repositories/${repoId}/branches/${branchId}/history`);

  await expect(page.getByRole("heading", { name: "Revision history" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Loaded 1 revisions.");
  await page.getByRole("button", { name: "Select" }).click();

  await page.getByRole("button", { name: "Info" }).click();
  await expect(page.getByRole("status")).toContainText("Loaded info data.");
  await expect(page.getByText('"author": "operator"')).toBeVisible();

  await page.getByRole("button", { name: "Tree panel" }).click();
  await expect(page.getByRole("status")).toContainText("Loaded tree data.");
  await expect(page.getByText("/README.md")).toBeVisible();

  await page.getByRole("button", { name: "Diff panel" }).click();
  await expect(page.getByRole("status")).toContainText("Loaded diff data.");
  await expect(page.getByText("modified")).toBeVisible();
});
