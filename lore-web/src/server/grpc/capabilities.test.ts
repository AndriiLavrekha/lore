import { status } from "@grpc/grpc-js";
import { describe, expect, it } from "vitest";

import {
  getCapabilityReport,
  grpcFailure,
  grpcSuccess,
  type CapabilityProbeAdapter,
} from "@/server/grpc/capabilities";

const baseConfig = {
  grpcTarget: "127.0.0.1:41337",
  httpBase: "http://127.0.0.1:41339",
  grpcTls: "insecure" as const,
  authMode: "none" as const,
};

function adapter(overrides: Partial<CapabilityProbeAdapter>): CapabilityProbeAdapter {
  return {
    health: async () => grpcSuccess({ ok: true }),
    environment: async () => grpcSuccess({ environment: { endpoint: {} } }),
    serverInfo: async () => grpcSuccess({ version: "test", features: [] }),
    repositoryList: async () => grpcSuccess({ count: 1 }),
    repoScoped: async () => grpcSuccess({ ok: true }),
    locks: async () => grpcSuccess({ ok: true }),
    notifications: async () => grpcSuccess({ ok: true }),
    ...overrides,
  };
}

describe("capability report", () => {
  it("does not treat ServerInfo success as authentication success", async () => {
    const report = await getCapabilityReport({
      config: baseConfig,
      adapter: adapter({
        repositoryList: async () =>
          grpcFailure(status.UNAUTHENTICATED, "missing bearer token"),
      }),
    });

    expect(report.serverInfo.status).toBe("ok");
    expect(report.authState).toBe("missing-token");
    expect(report.services.repositories.status).toBe("unavailable");
  });

  it("marks invalid tokens from intercepted services", async () => {
    const report = await getCapabilityReport({
      config: { ...baseConfig, authMode: "bearer" },
      bearerToken: "bad",
      adapter: adapter({
        repositoryList: async () => grpcFailure(status.PERMISSION_DENIED, "denied"),
      }),
    });

    expect(report.authState).toBe("invalid-token");
  });

  it("marks authenticated when repository list succeeds", async () => {
    const report = await getCapabilityReport({
      config: { ...baseConfig, authMode: "bearer" },
      bearerToken: "good",
      adapter: adapter({}),
    });

    expect(report.authState).toBe("authenticated");
    expect(report.services.repositories.status).toBe("available");
  });

  it("marks unauthorized-repository when repo scoped probe fails authz", async () => {
    const report = await getCapabilityReport({
      config: { ...baseConfig, authMode: "bearer" },
      bearerToken: "authn-only",
      selectedRepoId: "00112233445566778899aabbccddeeff",
      adapter: adapter({
        repoScoped: async () => grpcFailure(status.PERMISSION_DENIED, "repo denied"),
      }),
    });

    expect(report.authState).toBe("unauthorized-repository");
    expect(report.services.repoScoped.status).toBe("unavailable");
  });

  it("reports activity misconfigured when no notification stream is configured", async () => {
    const report = await getCapabilityReport({
      config: baseConfig,
      adapter: adapter({}),
    });

    expect(report.services.activity.status).toBe("misconfigured");
  });
});
