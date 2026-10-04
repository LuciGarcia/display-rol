import type { World } from "../../domain/world/world";
import {
  InvalidPersistedWorldError,
  WorldAlreadyExistsError,
  WorldNotFoundError,
} from "../../application/persistence/errors";
import {
  deserializeWorld,
  serializeWorld,
} from "../../application/persistence/serialization";
import type {
  WorldRepository,
  WorldSummary,
} from "../../application/persistence/WorldRepository";

// Adaptador de almacenamiento en memoria. Guarda el World serializado (como lo haría
// una base de datos), así lo recuperado nunca comparte referencias con el original.
// Dura lo que dura la página: se reemplaza por un adaptador real sin tocar el dominio.
export class InMemoryWorldRepository implements WorldRepository {
  private readonly store = new Map<string, string>();

  // `initial` permite sembrar contenido crudo (p. ej. para simular datos corruptos).
  constructor(initial: Readonly<Record<string, string>> = {}) {
    for (const [id, raw] of Object.entries(initial)) this.store.set(id, raw);
  }

  async create(world: World): Promise<void> {
    if (this.store.has(world.id)) throw new WorldAlreadyExistsError(world.id);
    this.store.set(world.id, serializeWorld(world));
  }

  async getById(id: string): Promise<World> {
    const raw = this.store.get(id);
    if (raw === undefined) throw new WorldNotFoundError(id);
    return deserializeWorld(raw);
  }

  async save(world: World): Promise<void> {
    if (!this.store.has(world.id)) throw new WorldNotFoundError(world.id);
    this.store.set(world.id, serializeWorld(world));
  }

  async delete(id: string): Promise<void> {
    if (!this.store.delete(id)) throw new WorldNotFoundError(id);
  }

  async list(): Promise<WorldSummary[]> {
    const summaries: WorldSummary[] = [];
    for (const raw of this.store.values()) {
      try {
        const { id, metadata } = deserializeWorld(raw);
        summaries.push({ id, name: metadata.name, updatedAt: metadata.updatedAt });
      } catch (error) {
        // Una entrada corrupta no debe impedir listar las demás.
        if (!(error instanceof InvalidPersistedWorldError)) throw error;
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
