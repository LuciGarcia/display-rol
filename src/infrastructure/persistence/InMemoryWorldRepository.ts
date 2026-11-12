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

// Adaptador de almacenamiento en memoria, SOLO para tests y desarrollo: no es durable.
// Guarda el World serializado (como lo haría una base de datos), así lo recuperado nunca
// comparte referencias con el original.
// `store` es el almacenamiento subyacente: compartirlo entre dos instancias simula que el
// proceso del repositorio se destruye pero los datos siguen existiendo. También permite
// sembrar contenido crudo (p. ej. datos corruptos).
export class InMemoryWorldRepository implements WorldRepository {
  // `state` es el estado de aplicación compartible igual que `store` (partida activa).
  constructor(
    private readonly store: Map<string, string> = new Map(),
    private readonly state: { activeId: string | null } = { activeId: null },
  ) {}

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

  async setActive(id: string): Promise<void> {
    if (!this.store.has(id)) throw new WorldNotFoundError(id);
    this.state.activeId = id;
  }

  async getActiveId(): Promise<string | null> {
    if (this.state.activeId !== null && this.store.has(this.state.activeId)) {
      return this.state.activeId;
    }
    return (await this.list())[0]?.id ?? null;
  }

  async list(): Promise<WorldSummary[]> {
    const summaries: WorldSummary[] = [];
    for (const raw of this.store.values()) {
      try {
        const { id, metadata } = deserializeWorld(raw);
        summaries.push({
          id,
          name: metadata.name,
          updatedAt: metadata.updatedAt,
        });
      } catch (error) {
        // Una entrada corrupta no debe impedir listar las demás.
        if (!(error instanceof InvalidPersistedWorldError)) throw error;
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
