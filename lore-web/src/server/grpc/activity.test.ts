import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { mapNotificationEvent, notificationStreamToSSE } from "@/server/grpc/activity";
import { sseFrame } from "@/server/grpc/streaming";

class FakeStream<T> extends EventEmitter {
  cancelCalled = false;
  cancel() {
    this.cancelCalled = true;
  }
  push(value: T) {
    this.emit("data", value);
  }
}

describe("activity SSE helpers", () => {
  it("frames multiline data as valid text/event-stream chunks", () => {
    expect(sseFrame("branch.pushed", { message: "a\nb" })).toBe(
      'event: branch.pushed\ndata: {"message":"a\\nb"}\n\n',
    );
  });

  it("maps branch and lock notification payloads to stable event names", () => {
    expect(mapNotificationEvent({ branchCreated: { branch: Buffer.from("11".repeat(16), "hex") } }).event).toBe(
      "branch.created",
    );
    expect(mapNotificationEvent({ resourceLocked: { resources: [] } }).event).toBe("lock.acquired");
  });

  it("cancels the gRPC stream when the browser SSE stream is aborted", async () => {
    const stream = new FakeStream<unknown>();
    const sse = notificationStreamToSSE(stream);
    await sse.cancel();
    expect(stream.cancelCalled).toBe(true);
  });
});
