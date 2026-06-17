import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

import type { LoreWebConfig } from "@/server/config";

export const PROTO_FILE_PATHS = [
  "lore/repository/v1/repository.proto",
  "lore/revision/v1/revision.proto",
  "lore/thin_client/v1/thin_client.proto",
  "lore/storage/v1/storage.proto",
  "lore/environment/v1/environment.proto",
  "lock.proto",
  "notification.proto",
  "admin.proto",
] as const;

export const PROTO_LOADER_OPTIONS = {
  keepCase: false,
  longs: String,
  enums: String,
  bytes: Buffer,
  defaults: true,
  oneofs: true,
  includeDirs: [getProtoIncludeDir()],
} satisfies protoLoader.Options;

let loadedDefinition: grpc.GrpcObject | undefined;
const clientConstructors = new Map<string, grpc.ServiceClientConstructor>();
const credentialsByKey = new Map<string, grpc.ChannelCredentials>();

function getRepoRoot() {
  return process.cwd().endsWith("lore-web") ? dirname(process.cwd()) : process.cwd();
}

export function getProtoIncludeDir() {
  return join(getRepoRoot(), "lore-proto", "proto");
}

export function loadProtoPackageDefinition(): grpc.GrpcObject {
  if (!loadedDefinition) {
    const packageDefinition = protoLoader.loadSync([...PROTO_FILE_PATHS], PROTO_LOADER_OPTIONS);
    loadedDefinition = grpc.loadPackageDefinition(packageDefinition);
  }

  return loadedDefinition;
}

export function getServiceConstructor(
  root: grpc.GrpcObject,
  servicePath: string,
): grpc.ServiceClientConstructor {
  const cached = clientConstructors.get(servicePath);
  if (cached) {
    return cached;
  }

  const service = servicePath
    .split(".")
    .reduce<unknown>((current, segment) => {
      if (current && typeof current === "object" && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, root);

  if (typeof service !== "function") {
    throw new Error(`gRPC service not found: ${servicePath}`);
  }

  const constructor = service as grpc.ServiceClientConstructor;
  clientConstructors.set(servicePath, constructor);
  return constructor;
}

function caFingerprint(caPath: string | undefined) {
  if (!caPath) {
    return "none";
  }

  return createHash("sha256").update(readFileSync(caPath)).digest("hex");
}

export function getChannelKey(config: Pick<LoreWebConfig, "grpcTarget" | "grpcTls" | "grpcCa">) {
  return `${config.grpcTarget}|${config.grpcTls}|${caFingerprint(config.grpcCa)}`;
}

export function getChannelCredentials(
  config: Pick<LoreWebConfig, "grpcTls" | "grpcCa">,
): grpc.ChannelCredentials {
  const key = `${config.grpcTls}|${caFingerprint(config.grpcCa)}`;
  const cached = credentialsByKey.get(key);
  if (cached) {
    return cached;
  }

  const credentials =
    config.grpcTls === "tls"
      ? grpc.credentials.createSsl(config.grpcCa ? readFileSync(config.grpcCa) : undefined)
      : grpc.credentials.createInsecure();

  credentialsByKey.set(key, credentials);
  return credentials;
}

export function createServiceClient<T extends grpc.Client>(
  servicePath: string,
  config: Pick<LoreWebConfig, "grpcTarget" | "grpcTls" | "grpcCa">,
): T {
  const ServiceConstructor = getServiceConstructor(loadProtoPackageDefinition(), servicePath);
  return new ServiceConstructor(
    config.grpcTarget,
    getChannelCredentials(config),
  ) as unknown as T;
}
