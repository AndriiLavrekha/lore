import { NextResponse } from "next/server";

import { branchCreateSchema, createBranch, listBranches } from "@/server/grpc/branches";
import { validateRepositoryId } from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { config, bearerToken } = await getRequestContext();
  const url = new URL(request.url);
  validateRepositoryId(id);
  return NextResponse.json(
    await listBranches(
      config,
      id,
      {
        creator: url.searchParams.get("creator") ?? undefined,
        includeDeleted: url.searchParams.get("include_deleted") === "true",
      },
      bearerToken,
    ),
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { config, bearerToken } = await getRequestContext();
  validateRepositoryId(id);
  const body = branchCreateSchema.parse(await request.json());
  return NextResponse.json(await createBranch(config, id, body, bearerToken), { status: 201 });
}
