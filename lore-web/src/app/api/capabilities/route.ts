import { NextResponse } from "next/server";

import { getCapabilityReport } from "@/server/grpc/capabilities";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const selectedRepoId = url.searchParams.get("repoId") ?? undefined;
  const { config, bearerToken } = await getRequestContext();

  return NextResponse.json(await getCapabilityReport({ config, bearerToken, selectedRepoId }));
}
