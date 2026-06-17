export type ProtoTimestamp = {
  seconds?: string | number | bigint | { toString(): string };
  nanos?: number;
};

export type ProtoAddress = {
  hash?: Uint8Array | Buffer | string | null;
  context?: Uint8Array | Buffer | string | null;
};

export type JsonAddress = {
  hash: string;
  context: string;
};

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

export function bytesToHex(value: Uint8Array | Buffer | string | null | undefined): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return Buffer.from(value, "binary").toString("hex");
  }

  return Buffer.from(value).toString("hex");
}

export function hexToBytes(hex: string, expectedBytes: number, label: string): Buffer {
  const expectedLength = expectedBytes * 2;

  if (hex.length !== expectedLength) {
    throw new Error(`${label} must be ${expectedBytes} bytes (${expectedLength} hex characters)`);
  }

  if (!HEX_PATTERN.test(hex)) {
    throw new Error(`${label} must be lowercase or uppercase hexadecimal`);
  }

  return Buffer.from(hex, "hex");
}

export function repoIdHexToBytes(repoIdHex: string): Buffer {
  return hexToBytes(repoIdHex, 16, "repository id");
}

export function hashHexToBytes(hashHex: string): Buffer {
  return hexToBytes(hashHex, 32, "hash");
}

export function uint64ToString(value: string | number | bigint | { toString(): string }): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("uint64 number is unsafe; use a string or BigInt");
    }

    return value.toString();
  }

  const rendered = value.toString();
  if (!/^\d+$/.test(rendered)) {
    throw new Error("uint64 value must be an unsigned integer");
  }

  return rendered;
}

export function timestampToIso(timestamp: ProtoTimestamp | null | undefined): string | undefined {
  if (!timestamp) {
    return undefined;
  }

  const seconds = Number(uint64ToString(timestamp.seconds ?? "0"));
  if (!Number.isSafeInteger(seconds)) {
    throw new Error("timestamp seconds exceed safe Date conversion range");
  }

  const millis = seconds * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
  return new Date(millis).toISOString();
}

export function addressToJson(address: ProtoAddress): JsonAddress {
  return {
    hash: bytesToHex(address.hash),
    context: bytesToHex(address.context),
  };
}
