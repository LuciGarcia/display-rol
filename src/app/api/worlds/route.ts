import { createWorldsApi } from "@/infrastructure/persistence/http/worldsApi";
import { getWorldRepository } from "@/app/lib/serverWorldRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const api = createWorldsApi(getWorldRepository);

export const GET = () => api.list();
export const POST = (request: Request) => api.create(request);
