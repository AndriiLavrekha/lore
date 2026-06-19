import "server-only";

import { cookies } from "next/headers";

import { getOidcRuntimeStatus } from "@/server/auth";
import { getServerConfig } from "@/server/config";
import { SETTINGS_COOKIE_NAMES, settingsResponseSchema } from "@/server/settings";

export async function readSessionSettingsResponse() {
  const cookieStore = await cookies();
  const hasBearerToken = Boolean(cookieStore.get(SETTINGS_COOKIE_NAMES.bearerToken)?.value);
  const config = getServerConfig({
    ...process.env,
    LORE_WEB_GRPC_TARGET:
      cookieStore.get(SETTINGS_COOKIE_NAMES.grpcTarget)?.value ??
      process.env.LORE_WEB_GRPC_TARGET,
    LORE_WEB_HTTP_BASE:
      cookieStore.get(SETTINGS_COOKIE_NAMES.httpBase)?.value ?? process.env.LORE_WEB_HTTP_BASE,
    LORE_WEB_GRPC_TLS:
      cookieStore.get(SETTINGS_COOKIE_NAMES.grpcTls)?.value ?? process.env.LORE_WEB_GRPC_TLS,
    LORE_WEB_GRPC_CA:
      cookieStore.get(SETTINGS_COOKIE_NAMES.grpcCa)?.value ?? process.env.LORE_WEB_GRPC_CA,
    LORE_WEB_AUTH_MODE:
      cookieStore.get(SETTINGS_COOKIE_NAMES.authMode)?.value ?? process.env.LORE_WEB_AUTH_MODE,
    LORE_WEB_NOTIFICATION_STREAM:
      cookieStore.get(SETTINGS_COOKIE_NAMES.notificationStream)?.value ??
      process.env.LORE_WEB_NOTIFICATION_STREAM,
  });
  const oidc = getOidcRuntimeStatus();
  const tokenForwarding =
    config.authMode === "oidc"
      ? oidc.tokenForwarding
      : config.authMode === "bearer" && hasBearerToken
        ? "bearer-cookie"
        : "disabled";

  return settingsResponseSchema.parse({
    ...config,
    hasBearerToken,
    oidc: {
      ...oidc,
      tokenForwarding,
    },
  });
}
