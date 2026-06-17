import { z } from "zod";

const envSchema = z.object({
  LORE_WEB_GRPC_TARGET: z.string().min(1).optional(),
  LORE_WEB_HTTP_BASE: z.string().url().optional(),
  LORE_WEB_GRPC_TLS: z.enum(["insecure", "tls"]).optional(),
  LORE_WEB_GRPC_CA: z.string().min(1).optional(),
  LORE_WEB_AUTH_MODE: z.enum(["none", "bearer", "oidc"]).optional(),
  LORE_WEB_NOTIFICATION_STREAM: z.string().min(1).optional(),
});

export type LoreWebConfig = {
  grpcTarget: string;
  httpBase: string;
  grpcTls: "insecure" | "tls";
  grpcCa?: string;
  authMode: "none" | "bearer" | "oidc";
  notificationStream?: string;
};

type EnvInput = Record<string, string | undefined>;

function deriveHttpBase(grpcTarget: string) {
  const host = grpcTarget.includes(":") ? grpcTarget.slice(0, grpcTarget.lastIndexOf(":")) : grpcTarget;
  return `http://${host || "127.0.0.1"}:41339`;
}

export function getServerConfig(env: EnvInput = process.env): LoreWebConfig {
  const parsed = envSchema.parse(env);
  const grpcTarget = parsed.LORE_WEB_GRPC_TARGET ?? "127.0.0.1:41337";

  return {
    grpcTarget,
    httpBase: parsed.LORE_WEB_HTTP_BASE ?? deriveHttpBase(grpcTarget),
    grpcTls: parsed.LORE_WEB_GRPC_TLS ?? "insecure",
    grpcCa: parsed.LORE_WEB_GRPC_CA,
    authMode: parsed.LORE_WEB_AUTH_MODE ?? "none",
    notificationStream: parsed.LORE_WEB_NOTIFICATION_STREAM,
  };
}
