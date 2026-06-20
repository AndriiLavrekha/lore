import { expect, test, type Page } from "@playwright/test";

type AuthMode = "none" | "bearer" | "oidc";

type SettingsPayload = {
  grpcTarget: string;
  httpBase: string;
  grpcTls: "insecure" | "tls";
  authMode: AuthMode;
  notificationStream: string;
  hasBearerToken: boolean;
  oidc: {
    enabled: boolean;
    missing: string[];
    callbackUrl: string;
    tokenForwarding: "disabled" | "bearer-cookie" | "oidc-access-token";
  };
};

test("no-auth mode renders disabled auth state and disabled OIDC sign-in when provider config is missing", async ({
  page,
}) => {
  await setAuthMode(page, "none");
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Auth", exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("Disabled");
  await expect(statusTile(page, "Auth mode")).toContainText("Requests are sent without credentials.");
  await expect(statusTile(page, "Forwarding")).toContainText("Disabled");
  await expect(oidcRow(page, "Readiness")).toContainText("Missing config");
  await expect(page.getByRole("button", { name: "Sign in with OIDC" })).toBeDisabled();
});

test("bearer mode saves and clears a token without rendering the saved value", async ({ page }) => {
  const posts: unknown[] = [];
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON() as Record<string, unknown>;
    posts.push(body);

    await route.fulfill({
      json:
        body.clearBearerToken === true
          ? settingsPayload({ authMode: "bearer", hasBearerToken: false })
          : settingsPayload({ authMode: "bearer", hasBearerToken: true }),
    });
  });

  await setAuthMode(page, "bearer");
  await page.goto("/auth");

  const tokenInput = page.getByLabel("Bearer token");
  await expect(statusTile(page, "Auth mode")).toContainText("save a bearer token");
  await expect(page.getByText("Not stored", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear bearer" })).toBeDisabled();

  await tokenInput.fill("playwright-secret-token");
  await page.getByRole("button", { name: "Save bearer" }).click();

  await expect(page.getByRole("status")).toContainText("Bearer token saved");
  await expect(tokenInput).toHaveValue("");
  expect(await page.content()).not.toContain("playwright-secret-token");
  await expect(page.getByText("Stored", { exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("stored bearer token can be forwarded");
  await expect(statusTile(page, "Forwarding")).toContainText("Bearer cookie");
  await expect(page.getByRole("button", { name: "Clear bearer" })).toBeEnabled();

  await page.getByRole("button", { name: "Clear bearer" }).click();

  await expect(page.getByRole("status")).toContainText("Bearer token cleared");
  await expect(tokenInput).toHaveValue("");
  await expect(page.getByText("Not stored", { exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("save a bearer token");
  await expect(statusTile(page, "Forwarding")).toContainText("Bearer cookie");
  await expect(page.getByRole("button", { name: "Clear bearer" })).toBeDisabled();

  expect(posts).toHaveLength(2);
  expect(posts[0]).toMatchObject({ authMode: "bearer" });
  expect(posts[0]).toHaveProperty("bearerToken");
  expect(posts[1]).toEqual({ clearBearerToken: true });
});

test("OIDC mode with missing config disables sign-in and preserves a safe Continue link", async ({
  page,
}) => {
  await setAuthMode(page, "oidc");
  await page.goto("/auth?next=/repositories");

  await expect(page.getByRole("heading", { name: "Auth", exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("OIDC");
  await expect(statusTile(page, "Auth mode")).toContainText("provider config for new sign-ins is incomplete");
  await expect(statusTile(page, "Requested next")).toContainText("/repositories");
  await expect(oidcRow(page, "Readiness")).toContainText("Missing config");
  await expect(oidcPanel(page)).toContainText("Unavailable");
  await expect(page.getByRole("button", { name: "Sign in with OIDC" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/repositories");
});

async function setAuthMode(page: Page, authMode: AuthMode) {
  await page.context().addCookies([
    {
      name: "lore_web_auth_mode",
      value: authMode,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

function statusTile(page: Page, label: string) {
  return page.locator("div").filter({ hasText: new RegExp(`^${label}`) }).first();
}

function oidcRow(page: Page, label: string) {
  return page.locator("dl div").filter({ hasText: new RegExp(`^${label}`) }).first();
}

function oidcPanel(page: Page) {
  return page.locator("div.rounded-md").filter({ has: page.getByText("OIDC", { exact: true }) }).last();
}

function settingsPayload({
  authMode,
  hasBearerToken,
}: {
  authMode: AuthMode;
  hasBearerToken: boolean;
}): SettingsPayload {
  return {
    grpcTarget: "127.0.0.1:50051",
    httpBase: "http://127.0.0.1:50052",
    grpcTls: "insecure",
    authMode,
    notificationStream: "lore.events",
    hasBearerToken,
    oidc: {
      enabled: false,
      missing: ["AUTH_SECRET", "AUTH_OIDC_ISSUER"],
      callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
      tokenForwarding: authMode === "bearer" && hasBearerToken ? "bearer-cookie" : "disabled",
    },
  };
}
