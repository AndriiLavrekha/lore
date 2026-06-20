import { expect, test, type Locator, type Page } from "@playwright/test";

type AuthMode = "none" | "bearer" | "oidc";

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
  const rawToken = "playwright-secret-token";

  await setAuthMode(page, "bearer");
  await page.goto("/auth");

  const tokenInput = page.getByLabel("Bearer token");
  await expect(statusTile(page, "Auth mode")).toContainText("save a bearer token");
  await expect(page.getByText("Not stored", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear bearer" })).toBeDisabled();

  await tokenInput.fill(rawToken);
  await page.getByRole("button", { name: "Save bearer" }).click();

  await expect(page.getByRole("status")).toContainText("Bearer token saved");
  await expect(tokenInput).toHaveValue("");
  await expect(page.getByText("Stored", { exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("stored bearer token can be forwarded");
  await expect(statusTile(page, "Forwarding")).toContainText("Bearer cookie");
  await expect(statusTile(page, "Forwarding")).toContainText("Stored bearer token will be forwarded");
  await expect(page.getByRole("button", { name: "Clear bearer" })).toBeEnabled();
  await expectRawTokenAbsentFromDom(page, rawToken);

  await page.reload();

  await expect(page.getByText("Stored", { exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("stored bearer token can be forwarded");
  await expect(statusTile(page, "Forwarding")).toContainText("Bearer cookie");
  await expect(statusTile(page, "Forwarding")).toContainText("Stored bearer token will be forwarded");
  await expectRawTokenAbsentFromDom(page, rawToken);

  await page.getByRole("button", { name: "Clear bearer" }).click();

  await expect(page.getByRole("status")).toContainText("Bearer token cleared");
  await expect(tokenInput).toHaveValue("");
  await expect(page.getByText("Not stored", { exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("save a bearer token");
  await expect(statusTile(page, "Forwarding")).toContainText("Bearer cookie");
  await expect(page.getByRole("button", { name: "Clear bearer" })).toBeDisabled();
  await expectRawTokenAbsentFromDom(page, rawToken);

  await page.reload();

  await expect(page.getByText("Not stored", { exact: true })).toBeVisible();
  await expect(statusTile(page, "Auth mode")).toContainText("save a bearer token");
  await expect(statusTile(page, "Forwarding")).toContainText("Bearer cookie");
  await expect(page.getByRole("button", { name: "Clear bearer" })).toBeDisabled();
  await expectRawTokenAbsentFromDom(page, rawToken);
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

function statusTile(page: Page, label: string): Locator {
  return page.getByRole("group", { name: label });
}

function oidcRow(page: Page, label: string) {
  return page.getByRole("group", { name: label });
}

function oidcPanel(page: Page) {
  return page.getByRole("group", { name: "OIDC" });
}

async function expectRawTokenAbsentFromDom(page: Page, rawToken: string) {
  expect(await page.content()).not.toContain(rawToken);
  await expect(page.locator("body")).not.toContainText(rawToken);
}
