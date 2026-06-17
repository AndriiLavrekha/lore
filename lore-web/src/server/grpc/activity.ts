import { type Client, type Metadata } from "@grpc/grpc-js";

import type { LoreWebConfig } from "@/server/config";
import { createServiceClient } from "@/server/grpc/clients";
import { bytesToHex } from "@/server/grpc/codec";
import { buildMetadata, withRepository } from "@/server/grpc/metadata";
import { sseFrame, type GrpcReadable } from "@/server/grpc/streaming";

type DynamicGrpcClient = Client & Record<string, unknown>;
type SubscribeMethod<TItem> = (
  request: { stream: string },
  metadata: Metadata,
) => GrpcReadable<TItem>;

export function mapNotificationEvent(event: Record<string, unknown>) {
  if (event.branchCreated) {
    return { event: "branch.created", data: normalizeEvent(event.branchCreated) };
  }
  if (event.branchPushed) {
    return { event: "branch.pushed", data: normalizeEvent(event.branchPushed) };
  }
  if (event.branchDeleted) {
    return { event: "branch.deleted", data: normalizeEvent(event.branchDeleted) };
  }
  if (event.resourceLocked) {
    return { event: "lock.acquired", data: normalizeEvent(event.resourceLocked) };
  }
  if (event.resourceUnlocked) {
    return { event: "lock.released", data: normalizeEvent(event.resourceUnlocked) };
  }
  return { event: "raw", data: normalizeEvent(event) };
}

function normalizeEvent(value: unknown): unknown {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return bytesToHex(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeEvent);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeEvent(item)]),
    );
  }
  return value;
}

export function notificationStreamToSSE(stream: GrpcReadable<unknown>) {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keepalive\n\n")), 15_000);
      stream.on("data", (item) => {
        const mapped = mapNotificationEvent(item as Record<string, unknown>);
        controller.enqueue(encoder.encode(sseFrame(mapped.event, mapped.data)));
      });
      stream.on("end", () => {
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      });
      stream.on("error", (error) => {
        if (heartbeat) clearInterval(heartbeat);
        controller.error(error);
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      stream.cancel?.();
    },
  });
}

export function subscribeNotifications(
  config: LoreWebConfig,
  repoId: string,
  stream: string,
  bearerToken?: string,
) {
  const client = createServiceClient<DynamicGrpcClient>("urc.notification.NotificationService", config);
  const subscribe = client.subscribe as SubscribeMethod<unknown> | undefined;
  if (!subscribe) {
    throw new Error("missing NotificationService.Subscribe method");
  }
  return subscribe({ stream }, withRepository(buildMetadata({ bearerToken }), repoId));
}
