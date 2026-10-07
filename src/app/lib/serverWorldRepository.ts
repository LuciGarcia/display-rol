import type { WorldRepository } from "@/application/persistence/WorldRepository";
import { PublishingWorldRepository } from "@/application/realtime/PublishingWorldRepository";
import { DrizzleWorldRepository } from "@/infrastructure/persistence/DrizzleWorldRepository";
import { getDatabase } from "@/infrastructure/persistence/drizzle/client";
import { createServerWorldPublisher } from "@/infrastructure/realtime/serverPublisher";

// Composición del lado servidor: solo lo importan las rutas /api/worlds.
// Persistir primero, publicar después: la difusión en vivo nunca decide qué se guarda.
let repository: WorldRepository | null = null;

export function getWorldRepository(): WorldRepository {
  return (repository ??= new PublishingWorldRepository(
    new DrizzleWorldRepository(getDatabase()),
    createServerWorldPublisher(),
  ));
}
