import { describe, expect, it } from "vitest";

import { deriveAuthRequestStatus } from "@/components/auth/auth-client";
import type { AuthPageState } from "@/server/auth-page";

const baseState: AuthPageState = {
  primaryMode: "none",
  nextPath: undefined,
  oidcReady: false,
  bearerReady: false,
  disabled: true,
};

describe("deriveAuthRequestStatus", () => {
  it("requires an OIDC access token before OIDC requests are ready", () => {
    expect(
      deriveAuthRequestStatus(
        {
          ...baseState,
          primaryMode: "oidc",
          oidcReady: true,
          disabled: false,
        },
        { hasAccessToken: false },
      ),
    ).toEqual({
      ready: false,
      forwardingReady: false,
    });
  });

  it("marks OIDC requests ready when the selected OIDC session has an access token", () => {
    expect(
      deriveAuthRequestStatus(
        {
          ...baseState,
          primaryMode: "oidc",
          oidcReady: true,
          disabled: false,
        },
        { hasAccessToken: true },
      ),
    ).toEqual({
      ready: true,
      forwardingReady: true,
    });
  });

  it("keeps bearer request readiness tied to the stored bearer token", () => {
    expect(
      deriveAuthRequestStatus(
        {
          ...baseState,
          primaryMode: "bearer",
          bearerReady: true,
          disabled: false,
        },
        { hasAccessToken: false },
      ),
    ).toEqual({
      ready: true,
      forwardingReady: true,
    });
  });
});
