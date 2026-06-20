import { expect, test } from "@playwright/test";

test("loads Overview and Settings from the dashboard shell", async ({ page }) => {
  await page.goto("/overview");

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByLabel("Dashboard", { exact: true }).getByRole("link", { name: "Repositories" })).toBeVisible();
  await expect(page.getByLabel("Dashboard", { exact: true }).getByRole("link", { name: "Auth" })).toBeVisible();

  await page.getByLabel("Dashboard", { exact: true }).getByRole("link", { name: "Auth" }).click();
  await expect(page.getByRole("heading", { name: "Auth", exact: true })).toBeVisible();

  await page.getByLabel("Dashboard", { exact: true }).getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("mobile dashboard navigation fits without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/auth");

  const mobileNav = page.getByLabel("Mobile dashboard", { exact: true });

  await expect(mobileNav.getByRole("link", { name: "Overview" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Repositories" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Auth" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(mobileNav).toHaveJSProperty("scrollWidth", await mobileNav.evaluate((nav) => nav.clientWidth));
});
