import type { World } from "../../domain/world/world";
import { WorldNotFoundError } from "./errors";
import type { WorldRepository, WorldSummary } from "./WorldRepository";

// Orquestación del ciclo de vida de una partida. Es la única regla de persistencia
// de la aplicación: la primera vez se crea y después se actualiza.
export class WorldLifecycleService {
  constructor(private readonly repository: WorldRepository) {}

  async persist(world: World): Promise<void> {
    try {
      await this.repository.save(world);
    } catch (error) {
      if (!(error instanceof WorldNotFoundError)) throw error;
      await this.repository.create(world);
    }
  }

  load(id: string): Promise<World> {
    return this.repository.getById(id);
  }

  list(): Promise<WorldSummary[]> {
    return this.repository.list();
  }

  remove(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
