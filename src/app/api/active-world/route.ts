import { createWorldsApi } from "@/infrastructure/persistence/http/worldsApi";
import { getWorldRepository } from "@/app/lib/serverWorldRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Partida activa: la que el Master tiene abierta y la que muestra el Display.
const api = createWorldsApi(getWorldRepository);

export const GET = () => api.getActive();
export const PUT = (request: Request) => api.setActive(request);
