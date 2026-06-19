import { describe, expect, it } from "vitest";

import { buildAuthPageState, safeAuthNextPath } from "@/server/auth-page";
import type { SettingsResponse } from "@/server/settings";

const baseSettings: SettingsResponse = {
  grpcTarget: "127.0.0.1:41337",
  httpBase: "http://127.0.0.1:41339",
  grpcTls: "insecure",
  authMode: "none",
  hasBearerToken: false,
  oidc: {
    enabled: false,
    missing: ["AUTH_SECRET"],
    callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
    tokenForwarding: "disabled",
  },
};

describe("safeAuthNextPath", () => {
  it("accepts local dashboard paths", () => {
    expect(safeAuthNextPath("/repositories")).toBe("/repositories");
    expect(safeAuthNextPath("/repositories?id=123")).toBe("/repositories?id=123");
  });

  it("rejects unsafe or auth-loop paths", () => {
    expect(safeAuthNextPath("https://example.test/repositories")).toBeUndefined();
    expect(safeAuthNextPath("//example.test/repositories")).toBeUndefined();
    expect(safeAuthNextPath("/api/settings")).toBeUndefined();
    expect(safeAuthNextPath("/auth?next=/repositories")).toBeUndefined();
    expect(safeAuthNextPath(undefined)).toBeUndefined();
  });
});

describe("buildAuthPageState", () => {
  it("uses no-auth state when auth mode is none", () => {
    expect(buildAuthPageState(baseSettings, undefined).primaryMode).toBe("none");
  });

  it("prioritizes bearer when auth mode is bearer", () => {
    expect(buildAuthPageState({ ...baseSettings, authMode: "bearer" }, "/repositories")).toMatchObject({
      primaryMode: "bearer",
      nextPath: "/repositories",
    });
  });

  it("marks oidc configured as ready", () => {
    expect(
      buildAuthPageState(
        {
          ...baseSettings,
          authMode: "oidc",
          oidc: {
            enabled: true,
            missing: [],
            callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
            tokenForwarding: "oidc-access-token",
          },
        },
        undefined,
      ),
    ).toMatchObject({
      primaryMode: "oidc",
      oidcReady: true,
    });
  });
});
