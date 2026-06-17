import { status } from "@grpc/grpc-js";
import { describe, expect, it } from "vitest";

import { buildLockResource, lockToJson, mapLockCapabilityError } from "@/server/grpc/locks";

describe("lock helpers", () => {
  it("allows zero hash for path-oriented lock resources", () => {
    const resource = buildLockResource({
      branch: "00112233445566778899aabbccddeeff",
      hash: "00".repeat(32),
      description: "/README.md",
    });

    expect(resource.hash).toEqual(Buffer.alloc(32));
  });

  it("rejects missing repo metadata before lock calls", () => {
    expect(() => buildLockResource({ branch: "bad", hash: "00".repeat(32), description: "x" })).toThrow(
      "branch id",
    );
  });

  it("maps UNIMPLEMENTED to unavailable capability", () => {
    expect(mapLockCapabilityError({ code: status.UNIMPLEMENTED, message: "no locks" })).toEqual({
      status: "unavailable",
      message: "no locks",
    });
  });

  it("maps lock records to JSON", () => {
    expect(
      lockToJson({
        resource: {
          branch: Buffer.from("00112233445566778899aabbccddeeff", "hex"),
          hash: Buffer.alloc(32),
          description: "/README.md",
        },
        owner: "operator",
        lockedAt: { seconds: "1700000000", nanos: 0 },
      }),
    ).toMatchObject({
      branch: "00112233445566778899aabbccddeeff",
      owner: "operator",
      description: "/README.md",
    });
  });
});
