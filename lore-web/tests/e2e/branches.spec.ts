import { expect, test } from "@playwright/test";

const repoId = "00112233445566778899aabbccddeeff";
const mainBranch = {
  id: "11112222333344445555666677778888",
  name: "main",
  creator: "operator",
  category: "",
  latest: "0".repeat(64),
  deleted: false,
  metadata: "aa".repeat(32),
};
const createdBranch = {
  ...mainBranch,
  id: "99998888777766665555444433332222",
  name: "ui-branch",
  category: "feature",
  metadata: "bb".repeat(32),
};

test("branches page performs create, push, protection, and delete actions", async ({ page }) => {
  let currentBranches = [mainBranch];
  await page.route(`**/api/repositories/${repoId}/branches**`, async (route) => {
    if (!new URL(route.request().url()).pathname.endsWith("/branches")) {
      await route.fallback();
      return;
    }
    if (route.request().method() === "POST") {
      currentBranches = [createdBranch, ...currentBranches];
      await route.fulfill({ json: createdBranch });
      return;
    }
    await route.fulfill({ json: { items: currentBranches, truncated: false } });
  });
  await page.route(`**/api/repositories/${repoId}/branches/${createdBranch.id}`, async (route) => {
    if (route.request().method() === "DELETE") {
      const deleted = { ...createdBranch, deleted: true };
      currentBranches = currentBranches.map((branch) => (branch.id === deleted.id ? deleted : branch));
      await route.fulfill({ json: deleted });
      return;
    }
    await route.fulfill({ json: {} });
  });
  await page.route(`**/api/repositories/${repoId}/branches/${createdBranch.id}/protection`, async (route) => {
    await route.fulfill({ json: { protect: true, metadata: "cc".repeat(32) } });
  });

  await page.goto(`/repositories/${repoId}/branches`);

  await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Loaded 1 branches.");

  await page.getByRole("textbox", { name: "Branch name" }).fill(createdBranch.name);
  await page.getByRole("button", { name: "Create branch" }).click();
  await expect(page.getByRole("status")).toContainText(`Created branch ${createdBranch.name}.`);
  await expect(page.getByRole("row", { name: /ui-branch/ })).toBeVisible();

  await page.getByRole("button", { name: "Push revision" }).click();
  await expect(page.getByRole("status")).toContainText(`Pushed revision to ${createdBranch.name}.`);

  await page.getByRole("button", { name: "Protect branch", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Branch protected.");

  await page.getByRole("textbox", { name: "Branch delete confirmation" }).fill(`${createdBranch.name} ${createdBranch.id}`);
  await page.getByRole("button", { name: "Delete branch" }).click();
  await expect(page.getByRole("status")).toContainText(`Deleted branch ${createdBranch.name}.`);
});
