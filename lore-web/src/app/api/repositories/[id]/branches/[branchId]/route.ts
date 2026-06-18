import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  branchDeleteSchema,
  branchPushSchema,
  deleteBranch,
  getBranch,
  mapGrpcBranchError,
  pushBranch,
} from "@/server/grpc/branches";
import { validateRepositoryId } from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; branchId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id, branchId } = await params;
  const { config, bearerToken } = await getRequestContext();
  validateRepositoryId(id);
  try {
    return NextResponse.json(await getBranch(config, id, branchId, bearerToken));
  } catch (error) {
    const mapped = mapGrpcBranchError(error as { code?: number; message?: string });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id, branchId } = await params;
  const { config, bearerToken } = await getRequestContext();
  validateRepositoryId(id);
  try {
    const body = branchDeleteSchema.parse(await request.json());
    return NextResponse.json(await deleteBranch(config, id, branchId, body, bearerToken));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid branch request" }, { status: 400 });
    }
    const mapped = mapGrpcBranchError(error as { code?: number; message?: string });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, branchId } = await params;
  const { config, bearerToken } = await getRequestContext();
  validateRepositoryId(id);
  try {
    const body = branchPushSchema.parse(await request.json());
    return NextResponse.json(await pushBranch(config, id, branchId, body, bearerToken));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid branch request" }, { status: 400 });
    }
    const mapped = mapGrpcBranchError(error as { code?: number; message?: string });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
