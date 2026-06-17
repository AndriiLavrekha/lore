import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import {
  buildRevisionListRequest,
  buildRevisionSpecifier,
  collectRevisionStream,
  revisionItemToJson,
} from "@/server/grpc/revisions";

const branchId = "00112233445566778899aabbccddeeff";
const signature = "aa".repeat(32);

class FakeStream<T> extends EventEmitter {
  cancelCalled = false;
  cancel() {
    this.cancelCalled = true;
  }
  push(value: T) {
    this.emit("data", value);
  }
  finish() {
    this.emit("end");
  }
}

describe("revision helpers", () => {
  it("uses start.signature for returned cursors", () => {
    expect(buildRevisionListRequest({ cursorSignature: signature })).toEqual({
      signature: Buffer.from(signature, "hex"),
    });
  });

  it("uses identifier.number = 0 only for explicit tip lookups", () => {
    expect(buildRevisionListRequest({ branchId, tip: true })).toEqual({
      identifier: {
        branchId: Buffer.from(branchId, "hex"),
        number: "0",
      },
    });
    expect(buildRevisionSpecifier({ branchId, number: "7" })).toEqual({
      identifier: {
        branchId: Buffer.from(branchId, "hex"),
        number: "7",
      },
    });
  });

  it("caps streamed revision tree/diff payloads", async () => {
    const stream = new FakeStream<number>();
    const result = collectRevisionStream(stream, { cap: 2 });

    stream.push(1);
    stream.push(2);
    stream.push(3);
    stream.finish();

    await expect(result).resolves.toMatchObject({ items: [1, 2], truncated: true });
    expect(stream.cancelCalled).toBe(true);
  });

  it("maps revision list items to JSON", () => {
    expect(
      revisionItemToJson({
        number: "9",
        signature: Buffer.from(signature, "hex"),
        metadata: Buffer.from("bb".repeat(32), "hex"),
      }),
    ).toMatchObject({ number: "9", signature, metadata: "bb".repeat(32) });
  });
});
