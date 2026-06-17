import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerConfig } from "@/server/config";
import {
  SETTINGS_COOKIE_NAMES,
  settingsRequestSchema,
  settingsResponseSchema,
} from "@/server/settings";

export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function readSettingsResponse() {
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

  return settingsResponseSchema.parse({
    ...config,
    hasBearerToken: Boolean(cookieStore.get(SETTINGS_COOKIE_NAMES.bearerToken)?.value),
  });
}

export async function GET() {
  return NextResponse.json(await readSettingsResponse());
}

export async function POST(request: Request) {
  const body = settingsRequestSchema.parse(await request.json());
  const cookieStore = await cookies();

  const pairs = [
    [SETTINGS_COOKIE_NAMES.grpcTarget, body.grpcTarget],
    [SETTINGS_COOKIE_NAMES.httpBase, body.httpBase],
    [SETTINGS_COOKIE_NAMES.grpcTls, body.grpcTls],
    [SETTINGS_COOKIE_NAMES.grpcCa, body.grpcCa],
    [SETTINGS_COOKIE_NAMES.authMode, body.authMode],
    [SETTINGS_COOKIE_NAMES.notificationStream, body.notificationStream],
    [SETTINGS_COOKIE_NAMES.bearerToken, body.bearerToken],
  ] as const;

  for (const [name, value] of pairs) {
    if (value) {
      cookieStore.set(name, value, cookieOptions);
    }
  }

  return NextResponse.json(await readSettingsResponse());
}
