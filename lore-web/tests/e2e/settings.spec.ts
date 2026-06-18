import { expect, test } from "@playwright/test";

test("settings page saves session overrides", async ({ page }) => {
  await page.route("**/api/settings", async (route) => {
    await route.fulfill({
      json: {
        grpcTarget: "127.0.0.1:41337",
        httpBase: "http://127.0.0.1:41339",
        grpcTls: "insecure",
        authMode: "none",
        notificationStream: "lore.events",
        hasBearerToken: false,
        oidc: {
          enabled: false,
          missing: ["AUTH_SECRET"],
          callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
          tokenForwarding: "disabled",
        },
      },
    });
  });

  await page.goto("/settings");

  await page.getByRole("textbox", { name: "Notification stream" }).fill("lore.events");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");
  await expect(page.getByRole("row", { name: /LORE_WEB_NOTIFICATION_STREAM lore.events/ })).toBeVisible();
});
