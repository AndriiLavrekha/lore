import { status, type Client, type Metadata } from "@grpc/grpc-js";

import type { LoreWebConfig } from "@/server/config";
import { createServiceClient } from "@/server/grpc/clients";
import { buildMetadata, withRepository } from "@/server/grpc/metadata";
import { collectStream, type GrpcReadable } from "@/server/grpc/streaming";

const PROBE_TIMEOUT_MS = 5_000;
type DynamicGrpcClient = Client & Record<string, unknown>;
type UnaryMethod<TResponse> = (
  request: unknown,
  metadata: Metadata,
  options: { deadline: Date },
  callback: (error: Error | null, response: TResponse) => void,
) => void;
type StreamMethod<TItem> = (
  request: unknown,
  metadata: Metadata,
  options: { deadline: Date },
) => GrpcReadable<TItem>;

export type ProbeStatus = "available" | "unavailable" | "misconfigured" | "unknown";
export type AuthState =
  | "reachable"
  | "missing-token"
  | "invalid-token"
  | "authenticated"
  | "unauthorized-repository";

export type ProbeResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code?: number; message: string };

export type CapabilityProbeAdapter = {
  health: () => Promise<ProbeResult>;
  environment: () => Promise<ProbeResult>;
  serverInfo: () => Promise<ProbeResult>;
  repositoryList: () => Promise<ProbeResult>;
  repoScoped: (repoId: string) => Promise<ProbeResult>;
  locks: (repoId?: string) => Promise<ProbeResult>;
  notifications: (stream?: string) => Promise<ProbeResult>;
};

export type CapabilityReport = {
  target: {
    grpc: string;
    http: string;
    tls: LoreWebConfig["grpcTls"];
  };
  authMode: LoreWebConfig["authMode"];
  authState: AuthState;
  notificationStream?: string;
  health: ServiceCapability;
  environment: ServiceCapability;
  serverInfo: ServiceCapability;
  services: {
    repositories: ServiceCapability;
    repoScoped: ServiceCapability;
    locks: ServiceCapability;
    activity: ServiceCapability;
  };
};

export type ServiceCapability = {
  status: ProbeStatus | "ok";
  message?: string;
  data?: unknown;
};

export function grpcSuccess<T>(data: T): ProbeResult<T> {
  return { ok: true, data };
}

export function grpcFailure(code: number | undefined, message: string): ProbeResult<never> {
  return { ok: false, code, message };
}

function serviceCapability(result: ProbeResult, availableStatus: ProbeStatus | "ok" = "available") {
  return result.ok
    ? { status: availableStatus, data: result.data }
    : { status: "unavailable" as const, message: result.message };
}

function authStateFromRepositoryProbe(
  result: ProbeResult,
  authMode: LoreWebConfig["authMode"],
  bearerToken?: string,
): AuthState {
  if (result.ok) {
    return "authenticated";
  }

  if (result.code === status.UNAUTHENTICATED) {
    return bearerToken ? "invalid-token" : "missing-token";
  }

  if (result.code === status.PERMISSION_DENIED) {
    return "invalid-token";
  }

  return "reachable";
}

export async function getCapabilityReport({
  config,
  bearerToken,
  selectedRepoId,
  adapter = createGrpcCapabilityAdapter(config, bearerToken),
}: {
  config: LoreWebConfig;
  bearerToken?: string;
  selectedRepoId?: string;
  adapter?: CapabilityProbeAdapter;
}): Promise<CapabilityReport> {
  const [health, environment, serverInfo, repositories] = await Promise.all([
    adapter.health(),
    adapter.environment(),
    adapter.serverInfo(),
    adapter.repositoryList(),
  ]);

  let authState = authStateFromRepositoryProbe(repositories, config.authMode, bearerToken);
  const repoScoped = selectedRepoId
    ? await adapter.repoScoped(selectedRepoId)
    : grpcFailure(undefined, "select a repository to probe repo-scoped authorization");

  if (
    selectedRepoId &&
    authState === "authenticated" &&
    !repoScoped.ok &&
    (repoScoped.code === status.UNAUTHENTICATED || repoScoped.code === status.PERMISSION_DENIED)
  ) {
    authState = "unauthorized-repository";
  }

  const [locks, notifications] = await Promise.all([
    adapter.locks(selectedRepoId),
    config.notificationStream
      ? adapter.notifications(config.notificationStream)
      : Promise.resolve(grpcFailure(undefined, "LORE_WEB_NOTIFICATION_STREAM is not configured")),
  ]);

  return {
    target: {
      grpc: config.grpcTarget,
      http: config.httpBase,
      tls: config.grpcTls,
    },
    authMode: config.authMode,
    authState,
    notificationStream: config.notificationStream,
    health: serviceCapability(health, "ok"),
    environment: serviceCapability(environment, "ok"),
    serverInfo: serviceCapability(serverInfo, "ok"),
    services: {
      repositories: serviceCapability(repositories),
      repoScoped: serviceCapability(repoScoped),
      locks: serviceCapability(locks),
      activity: config.notificationStream
        ? serviceCapability(notifications)
        : { status: "misconfigured", message: "LORE_WEB_NOTIFICATION_STREAM is not configured" },
    },
  };
}

function normalizeError(error: unknown): ProbeResult {
  const err = error as { code?: number; message?: string };
  return grpcFailure(err.code, err.message ?? "probe failed");
}

function unary<TResponse>(
  client: Record<string, unknown>,
  methodNames: string[],
  request: unknown,
  metadata = buildMetadata(),
): Promise<TResponse> {
  const methodName = methodNames.find((name) => typeof client[name] === "function");
  if (!methodName) {
    return Promise.reject(new Error(`missing gRPC method ${methodNames.join("/")}`));
  }

  return new Promise((resolve, reject) => {
    const method = client[methodName] as UnaryMethod<TResponse>;
    method.call(
      client,
      request,
      metadata,
      { deadline: new Date(Date.now() + PROBE_TIMEOUT_MS) },
      (error: Error | null, response: TResponse) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      },
    );
  });
}

function createGrpcCapabilityAdapter(
  config: LoreWebConfig,
  bearerToken?: string,
): CapabilityProbeAdapter {
  const metadata = buildMetadata({ bearerToken });

  return {
    async health() {
      try {
        const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
        const response = await fetch(`${config.httpBase}/health_check`, {
          cache: "no-store",
          signal,
        });
        return response.ok
          ? grpcSuccess({ status: response.status })
          : grpcFailure(response.status, `HTTP health returned ${response.status}`);
      } catch (error) {
        return normalizeError(error);
      }
    },
    async environment() {
      try {
        const client = createServiceClient<DynamicGrpcClient>(
          "lore.environment.v1.EnvironmentService",
          config,
        );
        return grpcSuccess(await unary(client, ["environmentGet", "EnvironmentGet"], {}, metadata));
      } catch (error) {
        return normalizeError(error);
      }
    },
    async serverInfo() {
      try {
        const client = createServiceClient<DynamicGrpcClient>("urc.rpc.AdminService", config);
        return grpcSuccess(await unary(client, ["serverInfo", "ServerInfo"], {}, metadata));
      } catch (error) {
        return normalizeError(error);
      }
    },
    async repositoryList() {
      try {
        const client = createServiceClient<DynamicGrpcClient>(
          "lore.repository.v1.RepositoryService",
          config,
        );
        const repositoryList = client.repositoryList as StreamMethod<unknown> | undefined;
        const call = repositoryList?.call(client, {}, metadata, {
          deadline: new Date(Date.now() + PROBE_TIMEOUT_MS),
        });
        if (!call) {
          throw new Error("missing RepositoryList method");
        }
        const result = await collectStream(call, { cap: 1 });
        return grpcSuccess({ count: result.items.length, truncated: result.truncated });
      } catch (error) {
        return normalizeError(error);
      }
    },
    async repoScoped(repoId) {
      try {
        const client = createServiceClient<DynamicGrpcClient>(
          "lore.revision.v1.RevisionService",
          config,
        );
        const branchList = client.branchList as StreamMethod<unknown> | undefined;
        const call = branchList?.call(
          client,
          { includeDeleted: false },
          withRepository(metadata, repoId),
          { deadline: new Date(Date.now() + PROBE_TIMEOUT_MS) },
        );
        if (!call) {
          throw new Error("missing BranchList method");
        }
        const result = await collectStream(call, { cap: 1 });
        return grpcSuccess({ count: result.items.length, truncated: result.truncated });
      } catch (error) {
        return normalizeError(error);
      }
    },
    async locks(repoId) {
      if (!repoId) {
        return grpcFailure(undefined, "select a repository to probe locks");
      }
      try {
        const client = createServiceClient<DynamicGrpcClient>("urc.lock.LockService", config);
        return grpcSuccess(
          await unary(client, ["query", "Query"], {}, withRepository(metadata, repoId)),
        );
      } catch (error) {
        return normalizeError(error);
      }
    },
    async notifications(stream) {
      if (!stream) {
        return grpcFailure(undefined, "notification stream is not configured");
      }
      return grpcSuccess({ stream });
    },
  };
}
