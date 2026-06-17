import { type Client, type Metadata } from "@grpc/grpc-js";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { LoreWebConfig } from "@/server/config";
import { createServiceClient } from "@/server/grpc/clients";
import { bytesToHex, hexToBytes, repoIdHexToBytes, uint64ToString } from "@/server/grpc/codec";
import { buildMetadata, withRepository } from "@/server/grpc/metadata";
import { collectStream, type GrpcReadable } from "@/server/grpc/streaming";

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

export const branchCreateSchema = z.object({
  name: z.string().min(1),
  creator: z.string().min(1).optional(),
  category: z.string().default(""),
  stack: z
    .array(
      z.object({
        branchId: z.string(),
        revisionSignature: z.string(),
      }),
    )
    .default([]),
});

export const branchDeleteSchema = z.object({
  branchName: z.string().min(1),
  confirmation: z.string().min(1),
});

export const branchPushSchema = z.object({
  revisionSignature: z.string(),
  force: z.boolean().default(false),
  fastForwardMerge: z.boolean().default(false),
});

export type BranchJson = {
  id: string;
  name: string;
  creator: string;
  category: string;
  created: string;
  latest: string;
  deleted: boolean;
  metadata: string;
};

type BranchRecord = {
  id?: Buffer | Uint8Array | string;
  name?: string;
  creator?: string;
  category?: string;
  created?: string | number | bigint | { toString(): string };
  latest?: Buffer | Uint8Array | string;
  deleted?: boolean;
  metadata?: Buffer | Uint8Array | string;
};

export function validateBranchId(id: string): Buffer {
  return hexToBytes(id, 16, "branch id");
}

export function validateRevisionSignature(signature: string): Buffer {
  return hexToBytes(signature, 32, "revision signature");
}

function uuidV7Bytes(): Buffer {
  return hexToBytes(uuidv7().replaceAll("-", ""), 16, "UUIDv7");
}

export function buildBranchCreateRequest(input: z.infer<typeof branchCreateSchema>) {
  return {
    id: uuidV7Bytes(),
    name: input.name,
    creator: input.creator,
    category: input.category,
    stack: input.stack.map((point) => ({
      branchId: validateBranchId(point.branchId),
      revisionSignature: validateRevisionSignature(point.revisionSignature),
    })),
  };
}

export function buildBranchPushRequest(
  branchIdOrInput: string | (z.infer<typeof branchPushSchema> & { branchId: string }),
  input?: z.infer<typeof branchPushSchema>,
) {
  const resolvedBranchId = typeof branchIdOrInput === "string" ? branchIdOrInput : branchIdOrInput.branchId;
  const resolvedInput = typeof branchIdOrInput === "string" ? input : branchIdOrInput;
  if (!resolvedInput) {
    throw new Error("branch push input is required");
  }

  return {
    id: validateBranchId(resolvedBranchId),
    revisionSignature: validateRevisionSignature(resolvedInput.revisionSignature),
    force: resolvedInput.force,
    fastForwardMerge: resolvedInput.fastForwardMerge,
  };
}

export function branchToJson(branch: BranchRecord): BranchJson {
  return {
    id: bytesToHex(branch.id),
    name: branch.name ?? "",
    creator: branch.creator ?? "",
    category: branch.category ?? "",
    created: uint64ToString(branch.created ?? "0"),
    latest: bytesToHex(branch.latest),
    deleted: Boolean(branch.deleted),
    metadata: bytesToHex(branch.metadata),
  };
}

export function assertBranchDeleteConfirmation({
  branchName,
  branchId,
  confirmation,
}: {
  branchName: string;
  branchId: string;
  confirmation: string;
}) {
  validateBranchId(branchId);
  if (confirmation !== `${branchName} ${branchId}`) {
    throw new Error(`Delete confirmation must exactly match "${branchName} ${branchId}"`);
  }
}

export function metadataHasRepository(metadata: Metadata, repoIdHex: string) {
  const repoId = repoIdHexToBytes(repoIdHex);
  const repositoryId = metadata.get("urc-repository-id-bin")[0];
  const partition = metadata.get("lore-partition-bin")[0];

  if (!Buffer.isBuffer(repositoryId) || !Buffer.isBuffer(partition)) {
    return false;
  }

  return (
    Buffer.compare(repositoryId, repoId) === 0 &&
    Buffer.compare(partition, repoId) === 0
  );
}

function deadline() {
  return { deadline: new Date(Date.now() + CALL_TIMEOUT_MS) };
}

function revisionClient(config: LoreWebConfig) {
  return createServiceClient<DynamicGrpcClient>("lore.revision.v1.RevisionService", config);
}

function branchMetadata(repoId: string, bearerToken?: string) {
  return withRepository(buildMetadata({ bearerToken }), repoId);
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

export async function listBranches(
  config: LoreWebConfig,
  repoId: string,
  options: { creator?: string; includeDeleted?: boolean },
  bearerToken?: string,
) {
  const client = revisionClient(config);
  const method = client.branchList as StreamMethod<{ branch?: BranchRecord }> | undefined;
  if (!method) {
    throw new Error("missing BranchList method");
  }
  const result = await collectStream(
    method(
      { creator: options.creator, includeDeleted: Boolean(options.includeDeleted) },
      branchMetadata(repoId, bearerToken),
      deadline(),
    ),
    { cap: 1_000 },
  );
  return { items: result.items.map((item) => branchToJson(item.branch ?? {})), truncated: result.truncated };
}

export async function getBranch(config: LoreWebConfig, repoId: string, branchId: string, bearerToken?: string) {
  const response = await unary<{ branch?: BranchRecord }>(
    revisionClient(config),
    "branchGet",
    { id: validateBranchId(branchId) },
    branchMetadata(repoId, bearerToken),
  );
  return branchToJson(response.branch ?? {});
}

export async function createBranch(
  config: LoreWebConfig,
  repoId: string,
  input: z.infer<typeof branchCreateSchema>,
  bearerToken?: string,
) {
  const response = await unary<{ branch?: BranchRecord }>(
    revisionClient(config),
    "branchCreate",
    buildBranchCreateRequest(input),
    branchMetadata(repoId, bearerToken),
  );
  return branchToJson(response.branch ?? {});
}

export async function deleteBranch(
  config: LoreWebConfig,
  repoId: string,
  branchId: string,
  input: z.infer<typeof branchDeleteSchema>,
  bearerToken?: string,
) {
  assertBranchDeleteConfirmation({ branchName: input.branchName, branchId, confirmation: input.confirmation });
  const response = await unary<{ branch?: BranchRecord }>(
    revisionClient(config),
    "branchDelete",
    { id: validateBranchId(branchId) },
    branchMetadata(repoId, bearerToken),
  );
  return branchToJson(response.branch ?? {});
}

export async function pushBranch(
  config: LoreWebConfig,
  repoId: string,
  branchId: string,
  input: z.infer<typeof branchPushSchema>,
  bearerToken?: string,
) {
  return unary(
    revisionClient(config),
    "branchPush",
    buildBranchPushRequest(branchId, input),
    branchMetadata(repoId, bearerToken),
  );
}
