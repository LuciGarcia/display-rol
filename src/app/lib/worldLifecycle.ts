import { WorldLifecycleService } from "@/application/persistence/WorldLifecycleService";
import { HttpWorldRepository } from "@/infrastructure/persistence/http/HttpWorldRepository";

// Raíz de composición del navegador: único lugar que elige el repositorio.
// Las partidas se guardan en PostgreSQL a través de /api/worlds (ver serverWorldRepository.ts).
// Para tests, InMemoryWorldRepository sigue siendo intercambiable sin tocar nada más.
export const worldLifecycle = new WorldLifecycleService(
  new HttpWorldRepository(),
);
