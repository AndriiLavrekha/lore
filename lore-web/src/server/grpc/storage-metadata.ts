import { createHash } from "node:crypto";
import { z } from "zod";

import { hashHexToBytes } from "@/server/grpc/codec";

export const branchProtectionRequestSchema = z.object({
  protect: z.boolean(),
  currentMetadataHash: z.string(),
  metadataPayloadBase64: z.string(),
});

export type BranchMetadata = Record<string, unknown> & {
  protect?: boolean;
};

export class BranchProtectionError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function decodeBranchMetadata(payload: Buffer | Uint8Array): BranchMetadata {
  try {
    const parsed = JSON.parse(Buffer.from(payload).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("branch metadata must be an object");
    }
    return parsed as BranchMetadata;
  } catch (error) {
    throw new BranchProtectionError(
      422,
      `Malformed branch metadata: ${error instanceof Error ? error.message : "decode failed"}`,
    );
  }
}

export function encodeBranchMetadata(metadata: BranchMetadata): Buffer {
  return Buffer.from(JSON.stringify(metadata), "utf8");
}

export async function toggleBranchProtection({
  currentMetadataHash,
  metadataPayload,
  protect,
  writeMetadata,
  branchMetadataSet,
}: {
  currentMetadataHash: string;
  metadataPayload: Buffer | Uint8Array;
  protect: boolean;
  writeMetadata: (payload: Buffer) => Promise<string>;
  branchMetadataSet: (expected: string, updated: string) => Promise<string>;
}) {
  hashHexToBytes(currentMetadataHash);
  const metadata = decodeBranchMetadata(metadataPayload);
  metadata.protect = protect;
  const updatedPayload = encodeBranchMetadata(metadata);
  const updated = await writeMetadata(updatedPayload);
  hashHexToBytes(updated);
  const current = await branchMetadataSet(currentMetadataHash, updated);

  if (current !== updated) {
    throw new BranchProtectionError(
      409,
      "Branch metadata changed before protection was applied; refresh and retry.",
    );
  }

  return { protect, metadata: updated };
}

export async function writeLocalMetadataHash(payload: Buffer) {
  return createHash("sha256").update(payload).digest("hex");
}
