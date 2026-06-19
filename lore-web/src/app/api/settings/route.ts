import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readSessionSettingsResponse } from "@/server/session-settings";
import { SETTINGS_COOKIE_NAMES, settingsRequestSchema } from "@/server/settings";

export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function GET() {
  return NextResponse.json(await readSessionSettingsResponse());
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

  if (body.clearBearerToken) {
    cookieStore.delete({
      name: SETTINGS_COOKIE_NAMES.bearerToken,
      path: cookieOptions.path,
    });
  }

  return NextResponse.json(await readSessionSettingsResponse());
}
