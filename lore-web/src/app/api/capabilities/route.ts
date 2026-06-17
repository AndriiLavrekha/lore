import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerConfig } from "@/server/config";
import { getCapabilityReport } from "@/server/grpc/capabilities";
import { SETTINGS_COOKIE_NAMES } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const selectedRepoId = url.searchParams.get("repoId") ?? undefined;
  const bearerToken = cookieStore.get(SETTINGS_COOKIE_NAMES.bearerToken)?.value;
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

  return NextResponse.json(await getCapabilityReport({ config, bearerToken, selectedRepoId }));
}
