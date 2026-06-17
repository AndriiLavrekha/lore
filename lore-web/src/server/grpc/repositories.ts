import { status, type Client, type Metadata } from "@grpc/grpc-js";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { createServiceClient } from "@/server/grpc/clients";
import { bytesToHex, hexToBytes, repoIdHexToBytes, uint64ToString } from "@/server/grpc/codec";
import { buildMetadata } from "@/server/grpc/metadata";
import { collectStream, type GrpcReadable } from "@/server/grpc/streaming";
import type { LoreWebConfig } from "@/server/config";

const CALL_TIMEOUT_MS = 5_000;

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

export const repositoryCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  defaultBranchName: z.string().min(1).default("main"),
  creator: z.string().min(1).optional(),
});

export const repositoryDeleteSchema = z.object({
  name: z.string().min(1),
  confirmation: z.string().min(1),
});

export type RepositoryJson = {
  id: string;
  name: string;
  description: string;
  defaultBranchId: string;
  defaultBranchName: string;
  creator: string;
  created: string;
  metadata: string;
};

type RepositoryRecord = {
  id?: Buffer | Uint8Array | string;
  name?: string;
  description?: string;
  defaultBranchId?: Buffer | Uint8Array | string;
  default_branch_id?: Buffer | Uint8Array | string;
  defaultBranchName?: string;
  default_branch_name?: string;
  creator?: string;
  created?: string | number | bigint | { toString(): string };
  metadata?: Buffer | Uint8Array | string;
};

export function validateRepositoryId(id: string): Buffer {
  return repoIdHexToBytes(id);
}

export function uuidV7Bytes(): Buffer {
  return hexToBytes(uuidv7().replaceAll("-", ""), 16, "UUIDv7");
}

export function buildRepositoryCreateRequest(input: z.infer<typeof repositoryCreateSchema>) {
  return {
    id: uuidV7Bytes(),
    name: input.name,
    description: input.description ?? "",
    defaultBranchId: uuidV7Bytes(),
    defaultBranchName: input.defaultBranchName ?? "main",
    creator: input.creator,
  };
}

export function repositoryToJson(repository: RepositoryRecord): RepositoryJson {
  return {
    id: bytesToHex(repository.id),
    name: repository.name ?? "",
    description: repository.description ?? "",
    defaultBranchId: bytesToHex(repository.defaultBranchId ?? repository.default_branch_id),
    defaultBranchName: repository.defaultBranchName ?? repository.default_branch_name ?? "",
    creator: repository.creator ?? "",
    created: uint64ToString(repository.created ?? "0"),
    metadata: bytesToHex(repository.metadata),
  };
}

export function validateDeleteConfirmation({
  id,
  name,
  confirmation,
}: {
  id: string;
  name: string;
  confirmation: string;
}) {
  validateRepositoryId(id);
  if (confirmation !== `${name} ${id}`) {
    throw new RepositoryHttpError(400, `Delete confirmation must exactly match "${name} ${id}"`);
  }
}

export class RepositoryHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function mapGrpcRepositoryError(error: { code?: number; message?: string }) {
  const message = error.message ?? "repository request failed";
  switch (error.code) {
    case status.ALREADY_EXISTS:
      return { status: 409, message };
    case status.NOT_FOUND:
      return { status: 404, message };
    case status.UNAUTHENTICATED:
      return { status: 401, message };
    case status.PERMISSION_DENIED:
      return { status: 403, message };
    default:
      return { status: 500, message };
  }
}

function deadline() {
  return { deadline: new Date(Date.now() + CALL_TIMEOUT_MS) };
}

function unary<TResponse>(
  client: DynamicGrpcClient,
  methodName: string,
  request: unknown,
  metadata: Metadata,
): Promise<TResponse> {
  const method = client[methodName] as UnaryMethod<TResponse> | undefined;
  if (!method) {
    return Promise.reject(new Error(`missing gRPC method ${methodName}`));
  }

  return new Promise((resolve, reject) => {
    method(request, metadata, deadline(), (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

function repositoryClient(config: LoreWebConfig) {
  return createServiceClient<DynamicGrpcClient>("lore.repository.v1.RepositoryService", config);
}

export async function listRepositories(config: LoreWebConfig, bearerToken?: string) {
  const client = repositoryClient(config);
  const method = client.repositoryList as StreamMethod<{ repository?: RepositoryRecord }> | undefined;
  if (!method) {
    throw new Error("missing RepositoryList method");
  }
  const result = await collectStream(method({}, buildMetadata({ bearerToken }), deadline()), {
    cap: 1_000,
  });
  return {
    items: result.items.map((item) => repositoryToJson(item.repository ?? {})),
    truncated: result.truncated,
  };
}

export async function getRepository(config: LoreWebConfig, id: string, bearerToken?: string) {
  const response = await unary<{ repository?: RepositoryRecord }>(
    repositoryClient(config),
    "repositoryGet",
    { id: validateRepositoryId(id) },
    buildMetadata({ bearerToken }),
  );
  return repositoryToJson(response.repository ?? {});
}

export async function getRepositoryMetadata(config: LoreWebConfig, id: string, bearerToken?: string) {
  const response = await unary<{ metadata?: Buffer | Uint8Array | string }>(
    repositoryClient(config),
    "repositoryMetadataGet",
    { id: validateRepositoryId(id) },
    buildMetadata({ bearerToken }),
  );
  return { metadata: bytesToHex(response.metadata) };
}

export async function createRepository(
  config: LoreWebConfig,
  input: z.infer<typeof repositoryCreateSchema>,
  bearerToken?: string,
) {
  const response = await unary<{ repository?: RepositoryRecord }>(
    repositoryClient(config),
    "repositoryCreate",
    buildRepositoryCreateRequest(input),
    buildMetadata({ bearerToken }),
  );
  return repositoryToJson(response.repository ?? {});
}

export async function deleteRepository(
  config: LoreWebConfig,
  id: string,
  input: z.infer<typeof repositoryDeleteSchema>,
  bearerToken?: string,
) {
  validateDeleteConfirmation({ id, name: input.name, confirmation: input.confirmation });
  const response = await unary<{ repository?: RepositoryRecord }>(
    repositoryClient(config),
    "repositoryDelete",
    { id: validateRepositoryId(id) },
    buildMetadata({ bearerToken }),
  );
  return repositoryToJson(response.repository ?? {});
}
