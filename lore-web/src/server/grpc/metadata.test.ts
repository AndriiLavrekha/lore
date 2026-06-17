import { describe, expect, it } from "vitest";

import { buildMetadata, withRepository } from "@/server/grpc/metadata";

describe("grpc metadata helpers", () => {
  it("adds bearer authorization only when a token is present", () => {
    expect(buildMetadata({ bearerToken: undefined }).get("authorization")).toEqual([]);
    expect(buildMetadata({ bearerToken: "token" }).get("authorization")).toEqual([
      "Bearer token",
    ]);
  });

  it("adds both binary repository metadata keys with raw repo id bytes", () => {
    const repoId = "00112233445566778899aabbccddeeff";
    const metadata = withRepository(buildMetadata({ bearerToken: "token" }), repoId);

    expect(metadata.get("urc-repository-id-bin")).toEqual([
      Buffer.from(repoId, "hex"),
    ]);
    expect(metadata.get("lore-partition-bin")).toEqual([Buffer.from(repoId, "hex")]);
    expect(metadata.get("authorization")).toEqual(["Bearer token"]);
  });
});
