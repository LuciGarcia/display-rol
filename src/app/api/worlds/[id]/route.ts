import { createWorldsApi } from "@/infrastructure/persistence/http/worldsApi";
import { getWorldRepository } from "@/app/lib/serverWorldRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const api = createWorldsApi(getWorldRepository);
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  return api.get((await params).id);
}
export async function PUT(request: Request, { params }: Context) {
  return api.save((await params).id, request);
}
export async function DELETE(_request: Request, { params }: Context) {
  return api.remove((await params).id);
}
