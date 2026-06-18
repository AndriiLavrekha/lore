import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
  try {
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "lock query failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  validateRepositoryId(id);
  const { config, bearerToken } = await getRequestContext();
  const url = new URL(request.url);
  try {
    const body = lockRequestSchema.parse(await request.json());
    if (url.searchParams.get("admin") === "true") {
      return NextResponse.json(await adminLock(config, id, body, bearerToken), { status: 201 });
    }
    return NextResponse.json(await acquireLocks(config, id, body, bearerToken), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid lock request" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "lock request failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  validateRepositoryId(id);
  const { config, bearerToken } = await getRequestContext();
  try {
    const body = lockRequestSchema.parse(await request.json());
    return NextResponse.json(await releaseLocks(config, id, body, bearerToken));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid lock request" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "lock release failed" },
      { status: 500 },
    );
  }
}
