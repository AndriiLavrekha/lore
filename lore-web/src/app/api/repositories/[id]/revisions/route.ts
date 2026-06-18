import { NextResponse } from "next/server";

import { listRevisions } from "@/server/grpc/revisions";
import { validateRepositoryId } from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  validateRepositoryId(id);
  const url = new URL(request.url);
  const { config, bearerToken } = await getRequestContext();
  const cursorSignature = url.searchParams.get("cursor");
  const branchId = url.searchParams.get("branchId");

  try {
    if (cursorSignature) {
      return NextResponse.json(await listRevisions(config, id, { cursorSignature }, bearerToken));
    }
    if (!branchId) {
      return NextResponse.json({ error: "branchId is required without cursor" }, { status: 400 });
    }
    return NextResponse.json(await listRevisions(config, id, { branchId, tip: true }, bearerToken));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "revision list failed" },
      { status: 500 },
    );
  }
}
