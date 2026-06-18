import { expect, test } from "@playwright/test";

const existingRepo = {
  id: "00112233445566778899aabbccddeeff",
  name: "sample",
  description: "Static fallback repository",
  defaultBranchId: "11111111111111111111111111111111",
  defaultBranchName: "main",
  creator: "operator",
  created: "0",
  metadata: "aa".repeat(32),
};

const createdRepo = {
  ...existingRepo,
  id: "019edb50b2297258a461119b62cacf80",
  name: "ui-created",
  description: "created from playwright",
  metadata: "bb".repeat(32),
};

test("repositories page creates, selects, and deletes through API actions", async ({ page }) => {
  await page.route("**/api/repositories", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: createdRepo });
      return;
    }
    await route.fulfill({ json: { items: [existingRepo], truncated: false } });
  });
  await page.route(`**/api/repositories/${createdRepo.id}`, async (route) => {
    await route.fulfill({ json: createdRepo });
  });

  await page.goto("/repositories");

  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Filter repositories" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh repositories" })).toBeVisible();

  await page.getByRole("textbox", { name: "New repository name" }).fill(createdRepo.name);
  await page.getByRole("textbox", { name: "Repository description" }).fill(createdRepo.description);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("status")).toContainText(`Created ${createdRepo.name}.`);
  await expect(page.getByRole("row", { name: /ui-created/ })).toBeVisible();

  await page.getByRole("textbox", { name: "Delete confirmation" }).fill(`${createdRepo.name} ${createdRepo.id}`);
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(page.getByRole("status")).toContainText(`Deleted ${createdRepo.name}.`);
  await expect(page.getByRole("row", { name: /ui-created/ })).toBeHidden();
});
