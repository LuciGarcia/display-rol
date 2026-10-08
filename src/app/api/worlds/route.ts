import { createWorldsApi } from "@/infrastructure/persistence/http/worldsApi";
import { getWorldRepository } from "@/app/lib/serverWorldRepository";
import { guard } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const api = createWorldsApi(getWorldRepository);

export const GET = guard.protect("world:list", (_request: Request) =>
  api.list(),
);
export const POST = guard.protect("world:create", (request: Request) =>
  api.create(request),
);
