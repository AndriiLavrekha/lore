import { describe, expect, it } from "vitest";

import { buildAuthOptions, getOidcRuntimeStatus } from "@/server/auth";

const configuredEnv = {
  AUTH_SECRET: "test-secret",
  AUTH_URL: "http://127.0.0.1:3000",
  AUTH_OIDC_ISSUER: "https://issuer.example.test",
  AUTH_OIDC_CLIENT_ID: "lore-web",
  AUTH_OIDC_CLIENT_SECRET: "client-secret",
};

describe("Auth.js OIDC configuration", () => {
  it("reports missing OIDC prerequisites without enabling token forwarding", () => {
    expect(getOidcRuntimeStatus({ AUTH_URL: "http://127.0.0.1:3000" })).toMatchObject({
      enabled: false,
      missing: [
        "AUTH_SECRET",
        "AUTH_OIDC_ISSUER",
        "AUTH_OIDC_CLIENT_ID",
        "AUTH_OIDC_CLIENT_SECRET",
      ],
      callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
      tokenForwarding: "disabled",
    });
  });

  it("enables an OIDC provider when every required value is configured", () => {
    const options = buildAuthOptions(configuredEnv);

    expect(options.providers).toHaveLength(1);
    expect(options.session).toMatchObject({ strategy: "jwt" });
    expect(getOidcRuntimeStatus(configuredEnv)).toMatchObject({
      enabled: true,
      tokenForwarding: "oidc-access-token",
    });
  });

  it("stores provider access tokens in the server-side JWT without exposing them in session JSON", async () => {
    const options = buildAuthOptions(configuredEnv);
    const jwt = await options.callbacks?.jwt?.({
      token: {},
      account: {
        access_token: "provider-access-token",
      },
    } as never);

    const session = await options.callbacks?.session?.({
      session: {
        expires: "2030-01-01T00:00:00.000Z",
      },
      token: jwt,
    } as never);

    expect(jwt).toMatchObject({ accessToken: "provider-access-token" });
    expect(session).toMatchObject({ hasAccessToken: true });
    expect(session).not.toHaveProperty("accessToken");
  });
});
