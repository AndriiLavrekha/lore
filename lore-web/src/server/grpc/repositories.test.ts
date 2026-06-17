import { status } from "@grpc/grpc-js";
import { describe, expect, it, vi } from "vitest";

import {
  buildRepositoryCreateRequest,
  mapGrpcRepositoryError,
  repositoryToJson,
  validateDeleteConfirmation,
  validateRepositoryId,
} from "@/server/grpc/repositories";

describe("repository service helpers", () => {
  it("rejects invalid repository ids before gRPC", () => {
    expect(() => validateRepositoryId("bad")).toThrow("repository id");
  });

  it("requires exact name and id delete confirmation before transport calls", async () => {
    const deleteTransport = vi.fn();
    const id = "00112233445566778899aabbccddeeff";

    expect(() => validateDeleteConfirmation({ id, name: "demo", confirmation: "demo" })).toThrow(
      "confirmation",
    );
    expect(deleteTransport).not.toHaveBeenCalled();
    expect(validateDeleteConfirmation({ id, name: "demo", confirmation: `demo ${id}` })).toBe(
      undefined,
    );
  });

  it("pre-generates UUIDv7-compatible ids for create requests", () => {
    const request = buildRepositoryCreateRequest({
      name: "demo",
      description: "Demo repository",
      defaultBranchName: "main",
    });

    expect(request.id).toHaveLength(16);
    expect(request.defaultBranchId).toHaveLength(16);
    expect(request.name).toBe("demo");
  });

  it("maps repository records to safe JSON", () => {
    const id = "00112233445566778899aabbccddeeff";
    const metadata = "aa".repeat(32);

    expect(
      repositoryToJson({
        id: Buffer.from(id, "hex"),
        name: "demo",
        description: "Demo",
        defaultBranchId: Buffer.from("11".repeat(16), "hex"),
        defaultBranchName: "main",
        creator: "operator",
        created: "42",
        metadata: Buffer.from(metadata, "hex"),
      }),
    ).toMatchObject({
      id,
      metadata,
      created: "42",
    });
  });

  it("maps expected gRPC status codes to HTTP responses", () => {
    expect(mapGrpcRepositoryError({ code: status.ALREADY_EXISTS, message: "exists" })).toEqual({
      status: 409,
      message: "exists",
    });
    expect(mapGrpcRepositoryError({ code: status.NOT_FOUND, message: "missing" }).status).toBe(404);
    expect(mapGrpcRepositoryError({ code: status.UNAUTHENTICATED, message: "auth" }).status).toBe(
      401,
    );
    expect(mapGrpcRepositoryError({ code: status.PERMISSION_DENIED, message: "denied" }).status).toBe(
      403,
    );
  });
});
