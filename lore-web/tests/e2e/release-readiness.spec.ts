import { expect, test } from "@playwright/test";

const repoId = "00112233445566778899aabbccddeeff";
const branchId = "ffeeddccbbaa99887766554433221100";

test("keyboard navigation reaches primary nav and repository actions", async ({ page }) => {
  await page.goto("/overview");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Lore Web/ })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Overview" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Repositories" })).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create repository" })).toBeVisible();
  await expect(page.getByLabel("Delete confirmation")).toBeVisible();
});

test("highest-value workflow pages expose controls and degraded states", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Token forwarding")).toBeVisible();
  await expect(page.getByText("OIDC callback")).toBeVisible();

  await page.goto(`/repositories/${repoId}/branches`);
  await expect(page.getByRole("button", { name: "Create branch" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Protect branch", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unprotect branch" })).toBeVisible();

  await page.goto(`/repositories/${repoId}/branches/${branchId}/history`);
  await expect(page.getByText("Forward cursor")).toBeVisible();
  await expect(page.getByText("Diff panel")).toBeVisible();

  await page.goto(`/repositories/${repoId}/locks`);
  await expect(page.getByRole("button", { name: "Acquire lock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Admin lock" })).toBeVisible();

  await page.goto(`/repositories/${repoId}/activity`);
  await expect(page.getByText("Reconnect state: idle")).toBeVisible();
  await expect(page.getByText("Notification stream: configure")).toBeVisible();
});
