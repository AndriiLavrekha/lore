import { describe, expect, it } from "vitest";

import { getServerConfig } from "@/server/config";

describe("server config", () => {
  it("uses safe local defaults", () => {
    expect(getServerConfig({})).toMatchObject({
      grpcTarget: "127.0.0.1:41337",
      httpBase: "http://127.0.0.1:41339",
      grpcTls: "insecure",
      authMode: "none",
      notificationStream: undefined,
    });
  });

  it("rejects unsupported TLS and auth modes", () => {
    expect(() => getServerConfig({ LORE_WEB_GRPC_TLS: "plain" })).toThrow();
    expect(() => getServerConfig({ LORE_WEB_AUTH_MODE: "basic" })).toThrow();
  });
});
