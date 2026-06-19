import { beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_COOKIE_NAMES } from "@/server/settings";

const mocks = vi.hoisted(() => ({
  cookieValues: {} as Record<string, string | undefined>,
  getServerOidcAccessToken: vi.fn<() => Promise<string | undefined>>(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues[name];

      return value ? { name, value } : undefined;
    },
  })),
}));

vi.mock("@/server/auth", () => ({
  getServerOidcAccessToken: mocks.getServerOidcAccessToken,
}));

async function readContext() {
  const { getRequestContext } = await import("@/server/request-context");

  return getRequestContext();
}

function setCookie(name: string, value: string) {
  mocks.cookieValues[name] = value;
}

describe("request context", () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks.cookieValues)) {
      delete mocks.cookieValues[key];
    }

    mocks.getServerOidcAccessToken.mockReset();
  });

  it("ignores a stale bearer cookie when auth mode is none", async () => {
    setCookie(SETTINGS_COOKIE_NAMES.authMode, "none");
    setCookie(SETTINGS_COOKIE_NAMES.bearerToken, "stale-bearer-token");
    mocks.getServerOidcAccessToken.mockResolvedValue("oidc-token");

    const context = await readContext();

    expect(context.config.authMode).toBe("none");
    expect(context.bearerToken).toBeUndefined();
    expect(mocks.getServerOidcAccessToken).not.toHaveBeenCalled();
  });

  it("uses the OIDC access token instead of a stale bearer cookie in oidc mode", async () => {
    setCookie(SETTINGS_COOKIE_NAMES.authMode, "oidc");
    setCookie(SETTINGS_COOKIE_NAMES.bearerToken, "stale-bearer-token");
    mocks.getServerOidcAccessToken.mockResolvedValue("oidc-token");

    const context = await readContext();

    expect(context.config.authMode).toBe("oidc");
    expect(context.bearerToken).toBe("oidc-token");
    expect(mocks.getServerOidcAccessToken).toHaveBeenCalledTimes(1);
  });

  it("uses the bearer cookie only in bearer mode", async () => {
    setCookie(SETTINGS_COOKIE_NAMES.authMode, "bearer");
    setCookie(SETTINGS_COOKIE_NAMES.bearerToken, "session-bearer-token");

    const context = await readContext();

    expect(context.config.authMode).toBe("bearer");
    expect(context.bearerToken).toBe("session-bearer-token");
    expect(mocks.getServerOidcAccessToken).not.toHaveBeenCalled();
  });

  it("preserves session cookie config overrides", async () => {
    setCookie(SETTINGS_COOKIE_NAMES.grpcTarget, "lore.example.test:443");
    setCookie(SETTINGS_COOKIE_NAMES.httpBase, "https://lore.example.test");
    setCookie(SETTINGS_COOKIE_NAMES.grpcTls, "tls");

    const context = await readContext();

    expect(context.config).toMatchObject({
      grpcTarget: "lore.example.test:443",
      httpBase: "https://lore.example.test",
      grpcTls: "tls",
    });
  });
});
