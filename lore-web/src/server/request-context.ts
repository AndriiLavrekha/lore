import { cookies } from "next/headers";

import { getServerOidcAccessToken } from "@/server/auth";
import { getServerConfig } from "@/server/config";
import { SETTINGS_COOKIE_NAMES } from "@/server/settings";

export async function getRequestContext() {
  const cookieStore = await cookies();
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

  const bearerToken =
    config.authMode === "oidc"
      ? await getServerOidcAccessToken()
      : config.authMode === "bearer"
        ? cookieStore.get(SETTINGS_COOKIE_NAMES.bearerToken)?.value
        : undefined;

  return {
    config,
    bearerToken,
  };
}
