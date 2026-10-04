import { WorldLifecycleService } from "@/application/persistence/WorldLifecycleService";
import { InMemoryWorldRepository } from "@/infrastructure/persistence/InMemoryWorldRepository";

// Raíz de composición: único lugar que elige el almacenamiento concreto.
// Para pasar a una base de datos real basta con cambiar el repositorio de esta línea.
export const worldLifecycle = new WorldLifecycleService(
  new InMemoryWorldRepository(),
);
