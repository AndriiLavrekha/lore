import { beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_COOKIE_NAMES } from "@/server/settings";

const mocks = vi.hoisted(() => ({
  cookieValues: {} as Record<string, string | undefined>,
  deletedCookies: [] as Array<string | { name: string; path?: string }>,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues[name];

      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      mocks.cookieValues[name] = value;
    },
    delete: (options: string | { name: string; path?: string }) => {
      mocks.deletedCookies.push(options);

      if (typeof options === "object" && options.path === "/") {
        delete mocks.cookieValues[options.name];
      }
    },
  })),
}));

function setCookie(name: string, value: string) {
  mocks.cookieValues[name] = value;
}

describe("settings route", () => {
  beforeEach(() => {
    for (const key of Object.keys(mocks.cookieValues)) {
      delete mocks.cookieValues[key];
    }

    mocks.deletedCookies = [];
  });

  it("clears a stored bearer token and reports disabled bearer forwarding", async () => {
    setCookie(SETTINGS_COOKIE_NAMES.authMode, "bearer");
    setCookie(SETTINGS_COOKIE_NAMES.bearerToken, "stored-bearer-token");
    const { POST } = await import("@/app/api/settings/route");

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/settings", {
        method: "POST",
        body: JSON.stringify({ clearBearerToken: true }),
      }),
    );
    const payload = await response.json();

    expect(mocks.deletedCookies).toContainEqual({
      name: SETTINGS_COOKIE_NAMES.bearerToken,
      path: "/",
    });
    expect(mocks.cookieValues[SETTINGS_COOKIE_NAMES.bearerToken]).toBeUndefined();
    expect(payload.hasBearerToken).toBe(false);
    expect(payload.oidc.tokenForwarding).toBe("disabled");
  });
});
