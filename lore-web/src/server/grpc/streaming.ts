type GrpcReadable<T> = {
  on(event: "data", listener: (item: T) => void): GrpcReadable<T>;
  on(event: "end", listener: () => void): GrpcReadable<T>;
  on(event: "error", listener: (error: Error) => void): GrpcReadable<T>;
  cancel?: () => void;
};

export type CollectedStream<T> = {
  items: T[];
  truncated: boolean;
};

export function collectStream<T>(
  call: GrpcReadable<T>,
  options: { cap: number },
): Promise<CollectedStream<T>> {
  if (!Number.isSafeInteger(options.cap) || options.cap < 1) {
    throw new Error("stream cap must be a positive safe integer");
  }

  return new Promise((resolve, reject) => {
    const items: T[] = [];
    let settled = false;

    const finish = (result: CollectedStream<T>) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    call.on("data", (item) => {
      if (settled) {
        return;
      }

      items.push(item);

      if (items.length >= options.cap) {
        call.cancel?.();
        finish({ items, truncated: true });
      }
    });

    call.on("end", () => finish({ items, truncated: false }));
    call.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function streamToSSE<T>(
  call: GrpcReadable<T>,
  mapEvent: (item: T) => { event: string; data: unknown },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      call.on("data", (item) => {
        const mapped = mapEvent(item);
        controller.enqueue(encoder.encode(sseFrame(mapped.event, mapped.data)));
      });
      call.on("end", () => controller.close());
      call.on("error", (error) => controller.error(error));
    },
    cancel() {
      call.cancel?.();
    },
  });
}
