import { NextResponse } from "next/server";

import { acquireLocks, adminLock, lockRequestSchema, queryLocks, releaseLocks } from "@/server/grpc/locks";
import { validateRepositoryId } from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  validateRepositoryId(id);
  const { config, bearerToken } = await getRequestContext();
  const url = new URL(request.url);
  return NextResponse.json(
    await queryLocks(
      config,
      id,
      {
        branch: url.searchParams.get("branch") ?? undefined,
        owner: url.searchParams.get("owner") ?? undefined,
        description: url.searchParams.get("description") ?? undefined,
      },
      bearerToken,
    ),
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  validateRepositoryId(id);
  const { config, bearerToken } = await getRequestContext();
  const url = new URL(request.url);
  const body = lockRequestSchema.parse(await request.json());
  if (url.searchParams.get("admin") === "true") {
    return NextResponse.json(await adminLock(config, id, body, bearerToken), { status: 201 });
  }
  return NextResponse.json(await acquireLocks(config, id, body, bearerToken), { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  validateRepositoryId(id);
  const { config, bearerToken } = await getRequestContext();
  const body = lockRequestSchema.parse(await request.json());
  return NextResponse.json(await releaseLocks(config, id, body, bearerToken));
}
