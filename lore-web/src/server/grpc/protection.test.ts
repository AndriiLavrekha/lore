import { describe, expect, it, vi } from "vitest";

import {
  BranchProtectionError,
  decodeBranchMetadata,
  encodeBranchMetadata,
  toggleBranchProtection,
} from "@/server/grpc/storage-metadata";

describe("branch protection metadata workflow", () => {
  it("updates the protect key in branch metadata", () => {
    const encoded = encodeBranchMetadata({ name: "main", protect: false });
    const decoded = decodeBranchMetadata(encoded);

    expect(decoded.protect).toBe(false);
  });

  it("returns 409 when BranchMetadataSet reports a CAS miss", async () => {
    await expect(
      toggleBranchProtection({
        currentMetadataHash: "11".repeat(32),
        metadataPayload: encodeBranchMetadata({ name: "main", protect: false }),
        protect: true,
        writeMetadata: async () => "22".repeat(32),
        branchMetadataSet: async () => "33".repeat(32),
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("refresh"),
    });
  });

  it("does not call BranchMetadataSet when metadata is malformed", async () => {
    const branchMetadataSet = vi.fn();

    await expect(
      toggleBranchProtection({
        currentMetadataHash: "11".repeat(32),
        metadataPayload: Buffer.from("not-json"),
        protect: true,
        writeMetadata: async () => "22".repeat(32),
        branchMetadataSet,
      }),
    ).rejects.toBeInstanceOf(BranchProtectionError);
    expect(branchMetadataSet).not.toHaveBeenCalled();
  });
});
