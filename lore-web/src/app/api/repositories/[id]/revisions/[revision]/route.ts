import { NextResponse } from "next/server";

import { revisionDiff, revisionInfo, revisionTree } from "@/server/grpc/revisions";
import { validateRepositoryId } from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; revision: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id, revision } = await params;
  validateRepositoryId(id);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "info";
  const { config, bearerToken } = await getRequestContext();
  const specifier = { cursorSignature: revision };

  if (view === "tree") {
    return NextResponse.json(await revisionTree(config, id, specifier, bearerToken));
  }
  if (view === "diff") {
    return NextResponse.json(
      await revisionDiff(config, id, { from: specifier, to: specifier }, bearerToken),
    );
  }
  return NextResponse.json(await revisionInfo(config, id, specifier, bearerToken));
}
