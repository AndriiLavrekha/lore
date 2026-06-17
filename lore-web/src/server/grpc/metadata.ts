import { Metadata } from "@grpc/grpc-js";

import { repoIdHexToBytes } from "@/server/grpc/codec";

export type MetadataOptions = {
  bearerToken?: string;
};

export function buildMetadata(options: MetadataOptions = {}): Metadata {
  const metadata = new Metadata();

  if (options.bearerToken) {
    metadata.set("authorization", `Bearer ${options.bearerToken}`);
  }

  return metadata;
}

export function withRepository(metadata: Metadata, repoIdHex: string): Metadata {
  const next = metadata.clone();
  const repoId = repoIdHexToBytes(repoIdHex);

  next.set("urc-repository-id-bin", repoId);
  next.set("lore-partition-bin", repoId);

  return next;
}
