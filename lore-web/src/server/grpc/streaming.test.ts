import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { collectStream, sseFrame } from "@/server/grpc/streaming";

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

describe("grpc streaming helpers", () => {
  it("marks capped stream collection as truncated and cancels the call", async () => {
    const stream = new FakeStream<number>();
    const result = collectStream(stream, { cap: 2 });

    stream.push(1);
    stream.push(2);
    stream.push(3);
    stream.finish();

    await expect(result).resolves.toEqual({
      items: [1, 2],
      truncated: true,
    });
    expect(stream.cancelCalled).toBe(true);
  });

  it("frames SSE events with escaped multiline data", () => {
    expect(sseFrame("branch", { message: "line1\nline2" })).toBe(
      'event: branch\ndata: {"message":"line1\\nline2"}\n\n',
    );
  });
});
