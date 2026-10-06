import { WorldLifecycleService } from "@/application/persistence/WorldLifecycleService";
import { InMemoryWorldRepository } from "@/infrastructure/persistence/InMemoryWorldRepository";

// Raíz de composición: único lugar que elige el almacenamiento concreto.
// Hoy es almacenamiento temporal en memoria: la Fase 11.1 lo reemplaza por el adaptador durable
// cambiando solo el repositorio de esta línea.
export const worldLifecycle = new WorldLifecycleService(
  new InMemoryWorldRepository(),
);
