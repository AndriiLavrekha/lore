import { NextResponse } from "next/server";

import { subscribeNotifications, notificationStreamToSSE } from "@/server/grpc/activity";
import { validateRepositoryId } from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  validateRepositoryId(id);
  const { config, bearerToken } = await getRequestContext();

  if (!config.notificationStream) {
    return NextResponse.json(
      { error: "LORE_WEB_NOTIFICATION_STREAM is not configured" },
      { status: 400 },
    );
  }

  const body = notificationStreamToSSE(
    subscribeNotifications(config, id, config.notificationStream, bearerToken),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
