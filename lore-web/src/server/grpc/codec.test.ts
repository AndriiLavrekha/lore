import { describe, expect, it } from "vitest";

import {
  addressToJson,
  bytesToHex,
  hashHexToBytes,
  repoIdHexToBytes,
  timestampToIso,
  uint64ToString,
} from "@/server/grpc/codec";

describe("grpc codec helpers", () => {
  it("rejects invalid repository id lengths before gRPC calls", () => {
    expect(() => repoIdHexToBytes("001122")).toThrow("repository id");
  });

  it("rejects invalid hash lengths before gRPC calls", () => {
    expect(() => hashHexToBytes("aa")).toThrow("hash");
  });

  it("round-trips bytes as lowercase hex", () => {
    expect(bytesToHex(Uint8Array.from([0, 17, 170, 255]))).toBe("0011aaff");
  });

  it("keeps uint64 values as strings instead of lossy numbers", () => {
    expect(uint64ToString("18446744073709551615")).toBe("18446744073709551615");
    expect(uint64ToString(BigInt("42"))).toBe("42");
    expect(() => uint64ToString(9_007_199_254_740_993)).toThrow("unsafe");
  });

  it("converts protobuf timestamps to ISO strings", () => {
    expect(timestampToIso({ seconds: "1700000000", nanos: 123_000_000 })).toBe(
      "2023-11-14T22:13:20.123Z",
    );
  });

  it("converts address byte fields to lowercase hex", () => {
    expect(
      addressToJson({
        hash: Buffer.from("aa".repeat(32), "hex"),
        context: Buffer.from("001122", "hex"),
      }),
    ).toEqual({
      hash: "aa".repeat(32),
      context: "001122",
    });
  });
});
