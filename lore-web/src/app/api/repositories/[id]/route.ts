import { NextResponse } from "next/server";

import {
  RepositoryHttpError,
  deleteRepository,
  getRepository,
  getRepositoryMetadata,
  mapGrpcRepositoryError,
  repositoryDeleteSchema,
  validateRepositoryId,
} from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { config, bearerToken } = await getRequestContext();
  try {
    validateRepositoryId(id);
    const [repository, metadata] = await Promise.all([
      getRepository(config, id, bearerToken),
      getRepositoryMetadata(config, id, bearerToken),
    ]);
    return NextResponse.json({ ...repository, metadata: metadata.metadata });
  } catch (error) {
    const mapped =
      error instanceof RepositoryHttpError
        ? { status: error.status, message: error.message }
        : mapGrpcRepositoryError(error as { code?: number; message?: string });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { config, bearerToken } = await getRequestContext();
  try {
    validateRepositoryId(id);
    const body = repositoryDeleteSchema.parse(await request.json());
    return NextResponse.json(await deleteRepository(config, id, body, bearerToken));
  } catch (error) {
    const mapped =
      error instanceof RepositoryHttpError
        ? { status: error.status, message: error.message }
        : mapGrpcRepositoryError(error as { code?: number; message?: string });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
