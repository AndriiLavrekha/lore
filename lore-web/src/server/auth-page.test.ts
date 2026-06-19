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
    expect(safeAuthNextPath("/auth/")).toBeUndefined();
    expect(safeAuthNextPath("/auth/settings")).toBeUndefined();
    expect(safeAuthNextPath(undefined)).toBeUndefined();
  });
});

describe("buildAuthPageState", () => {
  it("uses no-auth state when auth mode is none", () => {
    expect(buildAuthPageState(baseSettings, undefined)).toEqual({
      primaryMode: "none",
      nextPath: undefined,
      oidcReady: false,
      bearerReady: false,
      disabled: true,
    });
  });

  it("marks bearer auth not ready without a saved token", () => {
    expect(buildAuthPageState({ ...baseSettings, authMode: "bearer" }, "/repositories")).toEqual({
      primaryMode: "bearer",
      nextPath: "/repositories",
      oidcReady: false,
      bearerReady: false,
      disabled: false,
    });
  });

  it("marks bearer auth ready with a saved token", () => {
    expect(
      buildAuthPageState({ ...baseSettings, authMode: "bearer", hasBearerToken: true }, "/repositories"),
    ).toEqual({
      primaryMode: "bearer",
      nextPath: "/repositories",
      oidcReady: false,
      bearerReady: true,
      disabled: false,
    });
  });

  it("marks oidc auth not ready when oidc is disabled", () => {
    expect(buildAuthPageState({ ...baseSettings, authMode: "oidc" }, undefined)).toEqual({
      primaryMode: "oidc",
      nextPath: undefined,
      oidcReady: false,
      bearerReady: false,
      disabled: false,
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
    ).toEqual({
      primaryMode: "oidc",
      nextPath: undefined,
      oidcReady: true,
      bearerReady: false,
      disabled: false,
    });
  });
});
