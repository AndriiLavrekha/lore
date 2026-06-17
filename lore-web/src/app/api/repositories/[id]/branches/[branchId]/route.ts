import { NextResponse } from "next/server";

import {
  branchDeleteSchema,
  branchPushSchema,
  deleteBranch,
  getBranch,
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
  return NextResponse.json(await getBranch(config, id, branchId, bearerToken));
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id, branchId } = await params;
  const { config, bearerToken } = await getRequestContext();
  validateRepositoryId(id);
  const body = branchDeleteSchema.parse(await request.json());
  return NextResponse.json(await deleteBranch(config, id, branchId, body, bearerToken));
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, branchId } = await params;
  const { config, bearerToken } = await getRequestContext();
  validateRepositoryId(id);
  const body = branchPushSchema.parse(await request.json());
  return NextResponse.json(await pushBranch(config, id, branchId, body, bearerToken));
}
