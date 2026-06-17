import { describe, expect, it } from "vitest";

import { settingsRequestSchema, settingsResponseSchema } from "@/server/settings";

describe("settings schemas", () => {
  it("accepts bearer token updates without exposing token in responses", () => {
    const request = settingsRequestSchema.parse({
      grpcTarget: "127.0.0.1:41337",
      httpBase: "http://127.0.0.1:41339",
      grpcTls: "insecure",
      authMode: "bearer",
      bearerToken: "secret-token",
      notificationStream: "ops",
    });

    expect(request.bearerToken).toBe("secret-token");
    expect(
      settingsResponseSchema.parse({
        grpcTarget: request.grpcTarget,
        httpBase: request.httpBase,
        grpcTls: request.grpcTls,
        authMode: request.authMode,
        hasBearerToken: true,
        notificationStream: request.notificationStream,
        oidc: {
          enabled: false,
          missing: ["AUTH_SECRET"],
          callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
          tokenForwarding: "disabled",
        },
      }),
    ).not.toHaveProperty("bearerToken");
  });
});
