import { describe, expect, it, vi } from "vitest";

import {
  assertBranchDeleteConfirmation,
  branchToJson,
  buildBranchCreateRequest,
  buildBranchPushRequest,
  branchCreateSchema,
  mapGrpcBranchError,
  metadataHasRepository,
  validateBranchId,
  validateRevisionSignature,
} from "@/server/grpc/branches";
import { buildMetadata, withRepository } from "@/server/grpc/metadata";

const repoId = "00112233445566778899aabbccddeeff";
const branchId = "ffeeddccbbaa99887766554433221100";
const signature = "aa".repeat(32);

describe("branch service helpers", () => {
  it("rejects invalid branch ids and revision signatures before gRPC", () => {
    expect(() => validateBranchId("bad")).toThrow("branch id");
    expect(() => validateRevisionSignature("bad")).toThrow("revision signature");
  });

  it("requires delete confirmation before transport calls", () => {
    const transport = vi.fn();
    expect(() =>
      assertBranchDeleteConfirmation({ branchName: "main", branchId, confirmation: "main" }),
    ).toThrow("confirmation");
    expect(transport).not.toHaveBeenCalled();
  });

  it("builds branch create and push requests with byte fields", () => {
    const create = buildBranchCreateRequest({
      name: "feature",
      category: "work",
      stack: [{ branchId, revisionSignature: signature }],
    });
    const push = buildBranchPushRequest({
      branchId,
      revisionSignature: signature,
      force: false,
      fastForwardMerge: true,
    });

    expect(create.id).toHaveLength(16);
    expect(create.stack[0].branchId).toEqual(Buffer.from(branchId, "hex"));
    expect(push.revisionSignature).toEqual(Buffer.from(signature, "hex"));
  });

  it("rejects root branch creation through the generic branch create schema", () => {
    expect(() =>
      branchCreateSchema.parse({
        name: "root-like",
        category: "smoke",
        stack: [],
      }),
    ).toThrow("fork point");
  });

  it("maps branch records to JSON", () => {
    expect(
      branchToJson({
        id: Buffer.from(branchId, "hex"),
        name: "main",
        creator: "operator",
        category: "trunk",
        created: "7",
        latest: Buffer.from(signature, "hex"),
        deleted: false,
        metadata: Buffer.from("bb".repeat(32), "hex"),
      }),
    ).toMatchObject({
      id: branchId,
      latest: signature,
      deleted: false,
    });
  });

  it("detects both required repository metadata keys", () => {
    expect(metadataHasRepository(withRepository(buildMetadata(), repoId), repoId)).toBe(true);
    expect(metadataHasRepository(buildMetadata(), repoId)).toBe(false);
  });

  it("maps branch precondition failures to conflict responses", () => {
    expect(
      mapGrpcBranchError({
        code: 9,
        message: "9 FAILED_PRECONDITION: Branch is the default branch",
      }),
    ).toEqual({
      status: 409,
      message: "9 FAILED_PRECONDITION: Branch is the default branch",
    });
  });
});
