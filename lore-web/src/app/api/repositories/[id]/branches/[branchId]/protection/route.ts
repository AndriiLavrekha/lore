import { NextResponse } from "next/server";

import { validateBranchId } from "@/server/grpc/branches";
import { validateRepositoryId } from "@/server/grpc/repositories";
import {
  BranchProtectionError,
  branchProtectionRequestSchema,
  toggleBranchProtection,
  writeLocalMetadataHash,
} from "@/server/grpc/storage-metadata";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; branchId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, branchId } = await params;
  validateRepositoryId(id);
  validateBranchId(branchId);

  try {
    const body = branchProtectionRequestSchema.parse(await request.json());
    const result = await toggleBranchProtection({
      currentMetadataHash: body.currentMetadataHash,
      metadataPayload: Buffer.from(body.metadataPayloadBase64, "base64"),
      protect: body.protect,
      writeMetadata: writeLocalMetadataHash,
      branchMetadataSet: async (_expected, updated) => updated,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BranchProtectionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "branch protection failed" },
      { status: 400 },
    );
  }
}
