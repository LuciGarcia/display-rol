import { createWorldsApi } from "@/infrastructure/persistence/http/worldsApi";
import { getWorldRepository } from "@/app/lib/serverWorldRepository";
import { guard } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const api = createWorldsApi(getWorldRepository);
type Context = { params: Promise<{ id: string }> };

export const GET = guard.protect(
  "world:read",
  async (_request: Request, { params }: Context) => api.get((await params).id),
);
export const PUT = guard.protect(
  "world:save",
  async (request: Request, { params }: Context) =>
    api.save((await params).id, request),
);
export const DELETE = guard.protect(
  "world:delete",
  async (_request: Request, { params }: Context) =>
    api.remove((await params).id),
);
