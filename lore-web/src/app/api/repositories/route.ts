import { NextResponse } from "next/server";

import {
  createRepository,
  listRepositories,
  mapGrpcRepositoryError,
  normalizeRepositoryCreateInput,
  repositoryCreateSchema,
} from "@/server/grpc/repositories";
import { getRequestContext } from "@/server/request-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const { config, bearerToken } = await getRequestContext();
  try {
    return NextResponse.json(await listRepositories(config, bearerToken));
  } catch (error) {
    const mapped = mapGrpcRepositoryError(error as { code?: number; message?: string });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const { config, bearerToken } = await getRequestContext();
  const body = repositoryCreateSchema.parse(await request.json());
  try {
    return NextResponse.json(
      await createRepository(config, normalizeRepositoryCreateInput(body, config.authMode), bearerToken),
      { status: 201 },
    );
  } catch (error) {
    const mapped = mapGrpcRepositoryError(error as { code?: number; message?: string });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
