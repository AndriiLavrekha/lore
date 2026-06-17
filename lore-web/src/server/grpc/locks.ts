import { status, type Client, type Metadata } from "@grpc/grpc-js";
import { z } from "zod";

import type { LoreWebConfig } from "@/server/config";
import { createServiceClient } from "@/server/grpc/clients";
import { bytesToHex, hashHexToBytes, hexToBytes, timestampToIso } from "@/server/grpc/codec";
import { buildMetadata, withRepository } from "@/server/grpc/metadata";

const CALL_TIMEOUT_MS = 5_000;

type DynamicGrpcClient = Client & Record<string, unknown>;
type UnaryMethod<TResponse> = (
  request: unknown,
  metadata: Metadata,
  options: { deadline: Date },
  callback: (error: Error | null, response: TResponse) => void,
) => void;

export const lockResourceSchema = z.object({
  branch: z.string(),
  hash: z.string(),
  description: z.string().min(1),
});

export const lockRequestSchema = z.object({
  resources: z.array(lockResourceSchema).min(1),
  owner: z.string().min(1).optional(),
});

export function buildLockResource(input: z.infer<typeof lockResourceSchema>) {
  return {
    branch: hexToBytes(input.branch, 16, "branch id"),
    hash: hashHexToBytes(input.hash),
    description: input.description,
  };
}

export function lockToJson(lock: {
  resource?: { branch?: Buffer | Uint8Array | string; hash?: Buffer | Uint8Array | string; description?: string };
  owner?: string;
  lockedAt?: { seconds?: string; nanos?: number };
  locked_at?: { seconds?: string; nanos?: number };
}) {
  return {
    branch: bytesToHex(lock.resource?.branch),
    hash: bytesToHex(lock.resource?.hash),
    description: lock.resource?.description ?? "",
    owner: lock.owner ?? "",
    lockedAt: timestampToIso(lock.lockedAt ?? lock.locked_at),
  };
}

export function mapLockCapabilityError(error: { code?: number; message?: string }) {
  if (error.code === status.UNIMPLEMENTED) {
    return { status: "unavailable" as const, message: error.message ?? "LockService unavailable" };
  }
  return { status: "error" as const, message: error.message ?? "lock request failed" };
}

function deadline() {
  return { deadline: new Date(Date.now() + CALL_TIMEOUT_MS) };
}

function lockClient(config: LoreWebConfig) {
  return createServiceClient<DynamicGrpcClient>("urc.lock.LockService", config);
}

function repoMetadata(repoId: string, bearerToken?: string) {
  return withRepository(buildMetadata({ bearerToken }), repoId);
}

function unary<TResponse>(client: DynamicGrpcClient, methodName: string, request: unknown, metadata: Metadata) {
  const method = client[methodName] as UnaryMethod<TResponse> | undefined;
  if (!method) return Promise.reject(new Error(`missing gRPC method ${methodName}`));
  return new Promise<TResponse>((resolve, reject) => {
    method(request, metadata, deadline(), (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

export async function queryLocks(
  config: LoreWebConfig,
  repoId: string,
  filters: { branch?: string; owner?: string; description?: string },
  bearerToken?: string,
) {
  const response = await unary<{ result?: Array<Parameters<typeof lockToJson>[0]> }>(
    lockClient(config),
    "query",
    {
      branch: filters.branch ? hexToBytes(filters.branch, 16, "branch id") : undefined,
      owner: filters.owner,
      description: filters.description,
    },
    repoMetadata(repoId, bearerToken),
  );
  return { items: (response.result ?? []).map(lockToJson) };
}

export async function acquireLocks(config: LoreWebConfig, repoId: string, input: z.infer<typeof lockRequestSchema>, bearerToken?: string) {
  const response = await unary<{ locks?: Array<Parameters<typeof lockToJson>[0]> }>(
    lockClient(config),
    "lock",
    { resources: input.resources.map(buildLockResource) },
    repoMetadata(repoId, bearerToken),
  );
  return { items: (response.locks ?? []).map(lockToJson) };
}

export async function releaseLocks(config: LoreWebConfig, repoId: string, input: z.infer<typeof lockRequestSchema>, bearerToken?: string) {
  return unary(lockClient(config), "unlock", { resources: input.resources.map(buildLockResource) }, repoMetadata(repoId, bearerToken));
}

export async function adminLock(config: LoreWebConfig, repoId: string, input: z.infer<typeof lockRequestSchema>, bearerToken?: string) {
  const response = await unary<{ locks?: Array<Parameters<typeof lockToJson>[0]> }>(
    lockClient(config),
    "adminLock",
    { resources: input.resources.map(buildLockResource), owner: input.owner },
    repoMetadata(repoId, bearerToken),
  );
  return { items: (response.locks ?? []).map(lockToJson) };
}
