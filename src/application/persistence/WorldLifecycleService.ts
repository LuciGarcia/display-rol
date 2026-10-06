import type { World } from "../../domain/world/world";
import {
  PersistenceError,
  STORAGE_UNAVAILABLE_MESSAGE,
  WorldNotFoundError,
} from "./errors";
import type { WorldRepository, WorldSummary } from "./WorldRepository";

// Orquestación del ciclo de vida de una partida. Es la única regla de persistencia
// de la aplicación: la primera vez se crea y después se actualiza.
// También es la frontera de errores: lo que sale de aquí es siempre un PersistenceError
// (o subclase) con un mensaje seguro. Los errores propios del adaptador (driver, SQL,
// conexión) nunca llegan a la UI; quedan solo como `cause`.
export class WorldLifecycleService {
  constructor(private readonly repository: WorldRepository) {}

  async persist(world: World): Promise<void> {
    try {
      await this.guard(() => this.repository.save(world));
    } catch (error) {
      if (!(error instanceof WorldNotFoundError)) throw error;
      await this.guard(() => this.repository.create(world));
    }
  }

  load(id: string): Promise<World> {
    return this.guard(() => this.repository.getById(id));
  }

  list(): Promise<WorldSummary[]> {
    return this.guard(() => this.repository.list());
  }

  remove(id: string): Promise<void> {
    return this.guard(() => this.repository.delete(id));
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError(STORAGE_UNAVAILABLE_MESSAGE, { cause: error });
    }
  }
}
