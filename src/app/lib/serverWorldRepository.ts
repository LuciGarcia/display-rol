import { DrizzleWorldRepository } from "@/infrastructure/persistence/DrizzleWorldRepository";
import { getDatabase } from "@/infrastructure/persistence/drizzle/client";

// Composición del lado servidor: solo lo importan las rutas /api/worlds.
let repository: DrizzleWorldRepository | null = null;

export function getWorldRepository(): DrizzleWorldRepository {
  return (repository ??= new DrizzleWorldRepository(getDatabase()));
}
