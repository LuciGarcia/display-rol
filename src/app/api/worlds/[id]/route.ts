import { createWorldsApi } from "@/infrastructure/persistence/http/worldsApi";
import { getWorldRepository } from "@/app/lib/serverWorldRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const api = createWorldsApi(getWorldRepository);
type Context = { params: Promise<{ id: string }> };

export const GET = async (_request: Request, { params }: Context) =>
  api.get((await params).id);
export const PUT = async (request: Request, { params }: Context) =>
  api.save((await params).id, request);
export const DELETE = async (_request: Request, { params }: Context) =>
  api.remove((await params).id);
