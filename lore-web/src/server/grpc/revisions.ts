import { type Client, type Metadata } from "@grpc/grpc-js";

import type { LoreWebConfig } from "@/server/config";
import { createServiceClient } from "@/server/grpc/clients";
import { bytesToHex, hashHexToBytes, hexToBytes, uint64ToString } from "@/server/grpc/codec";
import { buildMetadata, withRepository } from "@/server/grpc/metadata";
import { collectStream, type GrpcReadable } from "@/server/grpc/streaming";

const CALL_TIMEOUT_MS = 5_000;
const STREAM_CAP = 500;

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

export type RevisionListInput =
  | { cursorSignature: string }
  | { branchId: string; tip: true }
  | { branchId: string; number: string };

export function buildRevisionSpecifier(input: RevisionListInput) {
  if ("cursorSignature" in input) {
    return { signature: hashHexToBytes(input.cursorSignature) };
  }
  return {
    identifier: {
      branchId: hexToBytes(input.branchId, 16, "branch id"),
      number: "tip" in input ? "0" : input.number,
    },
  };
}

export function buildRevisionListRequest(input: RevisionListInput) {
  return buildRevisionSpecifier(input);
}

export function collectRevisionStream<T>(stream: GrpcReadable<T>, options = { cap: STREAM_CAP }) {
  return collectStream(stream, options);
}

export function revisionItemToJson(item: {
  number?: string | number | bigint | { toString(): string };
  signature?: Buffer | Uint8Array | string;
  metadata?: Buffer | Uint8Array | string;
  state?: Buffer | Uint8Array | string;
}) {
  return {
    number: uint64ToString(item.number ?? "0"),
    signature: bytesToHex(item.signature),
    metadata: bytesToHex(item.metadata),
    state: bytesToHex(item.state),
  };
}

function deadline() {
  return { deadline: new Date(Date.now() + CALL_TIMEOUT_MS) };
}

function revisionClient(config: LoreWebConfig) {
  return createServiceClient<DynamicGrpcClient>("lore.revision.v1.RevisionService", config);
}

function thinClient(config: LoreWebConfig) {
  return createServiceClient<DynamicGrpcClient>("lore.thin_client.v1.ThinClientService", config);
}

function repoMetadata(repoId: string, bearerToken?: string) {
  return withRepository(buildMetadata({ bearerToken }), repoId);
}

function unary<TResponse>(
  client: DynamicGrpcClient,
  methodName: string,
  request: unknown,
  metadata: Metadata,
) {
  const method = client[methodName] as UnaryMethod<TResponse> | undefined;
  if (!method) {
    return Promise.reject(new Error(`missing gRPC method ${methodName}`));
  }
  return new Promise<TResponse>((resolve, reject) => {
    method.call(client, request, metadata, deadline(), (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

export async function listRevisions(
  config: LoreWebConfig,
  repoId: string,
  input: RevisionListInput,
  bearerToken?: string,
) {
  const response = await unary<{
    items?: Array<Parameters<typeof revisionItemToJson>[0]>;
    signatureForward?: Buffer;
    signatureBackward?: Buffer;
  }>(
    revisionClient(config),
    "revisionList",
    buildRevisionListRequest(input),
    repoMetadata(repoId, bearerToken),
  );
  return {
    items: (response.items ?? []).map(revisionItemToJson),
    signatureForward: bytesToHex(response.signatureForward),
    signatureBackward: bytesToHex(response.signatureBackward),
  };
}

export async function revisionInfo(
  config: LoreWebConfig,
  repoId: string,
  input: RevisionListInput,
  bearerToken?: string,
) {
  return unary(thinClient(config), "revisionInfo", buildRevisionSpecifier(input), repoMetadata(repoId, bearerToken));
}

export async function revisionTree(
  config: LoreWebConfig,
  repoId: string,
  input: RevisionListInput & { pathPrefix?: string; maxDepth?: number },
  bearerToken?: string,
) {
  const client = thinClient(config);
  const method = client.revisionTree as StreamMethod<unknown> | undefined;
  if (!method) throw new Error("missing RevisionTree method");
  return collectRevisionStream(
    method.call(
      client,
      { ...buildRevisionSpecifier(input), pathPrefix: input.pathPrefix, maxDepth: input.maxDepth },
      repoMetadata(repoId, bearerToken),
      deadline(),
    ),
  );
}

export async function revisionDiff(
  config: LoreWebConfig,
  repoId: string,
  input: { from: RevisionListInput; to: RevisionListInput; autoresolve?: boolean },
  bearerToken?: string,
) {
  const client = thinClient(config);
  const method = client.revisionDiff as StreamMethod<unknown> | undefined;
  if (!method) throw new Error("missing RevisionDiff method");
  return collectRevisionStream(
    method.call(
      client,
      {
        ...prefixSpecifier("from", buildRevisionSpecifier(input.from)),
        ...prefixSpecifier("to", buildRevisionSpecifier(input.to)),
        autoresolve: Boolean(input.autoresolve),
      },
      repoMetadata(repoId, bearerToken),
      deadline(),
    ),
  );
}

function prefixSpecifier(side: "from" | "to", specifier: ReturnType<typeof buildRevisionSpecifier>) {
  if ("signature" in specifier) {
    return side === "from" ? { signatureFrom: specifier.signature } : { signatureTo: specifier.signature };
  }
  return side === "from"
    ? { identifierFrom: specifier.identifier }
    : { identifierTo: specifier.identifier };
}
