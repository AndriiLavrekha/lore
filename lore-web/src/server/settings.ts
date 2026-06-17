import { z } from "zod";

export const SETTINGS_COOKIE_NAMES = {
  grpcTarget: "lore_web_grpc_target",
  httpBase: "lore_web_http_base",
  grpcTls: "lore_web_grpc_tls",
  grpcCa: "lore_web_grpc_ca",
  authMode: "lore_web_auth_mode",
  notificationStream: "lore_web_notification_stream",
  bearerToken: "lore_web_bearer_token",
} as const;

export const settingsRequestSchema = z.object({
  grpcTarget: z.string().min(1).optional(),
  httpBase: z.string().url().optional(),
  grpcTls: z.enum(["insecure", "tls"]).optional(),
  grpcCa: z.string().min(1).optional(),
  authMode: z.enum(["none", "bearer", "oidc"]).optional(),
  notificationStream: z.string().min(1).optional(),
  bearerToken: z.string().min(1).optional(),
});

export const settingsResponseSchema = z.object({
  grpcTarget: z.string(),
  httpBase: z.string(),
  grpcTls: z.enum(["insecure", "tls"]),
  grpcCa: z.string().optional(),
  authMode: z.enum(["none", "bearer", "oidc"]),
  notificationStream: z.string().optional(),
  hasBearerToken: z.boolean(),
});

export type SettingsRequest = z.infer<typeof settingsRequestSchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
