import { desc, eq } from "drizzle-orm";
import type { World } from "../../domain/world/world";
import {
  InvalidPersistedWorldError,
  PersistenceError,
  STORAGE_UNAVAILABLE_MESSAGE,
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
import type { Database } from "./drizzle/client";
import { games } from "./drizzle/schema";

// Convención de timestamps: el dominio manda. metadata.createdAt/updatedAt deben ser fechas
// ISO-8601; se guardan como timestamptz y list() devuelve su forma canónica (toISOString).
// La base nunca genera fechas por su cuenta.
function toDate(value: string, field: "createdAt" | "updatedAt"): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidPersistedWorldError(
      `no se puede guardar (metadata.${field} no es una fecha ISO válida)`,
    );
  }
  return date;
}

export class DrizzleWorldRepository implements WorldRepository {
  constructor(private readonly db: Database) {}

  async create(world: World): Promise<void> {
    const worldJson = serializeWorld(world);
    const createdAt = toDate(world.metadata.createdAt, "createdAt");
    const updatedAt = toDate(world.metadata.updatedAt, "updatedAt");
    const inserted = await this.run(() =>
      this.db
        .insert(games)
        .values({
          id: world.id,
          name: world.metadata.name,
          worldJson,
          createdAt,
          updatedAt,
        })
        .onConflictDoNothing()
        .returning({ id: games.id }),
    );
    if (inserted.length === 0) throw new WorldAlreadyExistsError(world.id);
  }

  async getById(id: string): Promise<World> {
    const rows = await this.run(() =>
      this.db
        .select({ worldJson: games.worldJson })
        .from(games)
        .where(eq(games.id, id))
        .limit(1),
    );
    if (rows.length === 0) throw new WorldNotFoundError(id);
    const world = deserializeWorld(rows[0].worldJson); // valida con WorldSchema
    if (world.id !== id) {
      throw new InvalidPersistedWorldError(
        "el id del World no coincide con el del registro",
      );
    }
    return world;
  }

  async save(world: World): Promise<void> {
    const worldJson = serializeWorld(world);
    const updatedAt = toDate(world.metadata.updatedAt, "updatedAt");
    const updated = await this.run(() =>
      this.db
        .update(games)
        .set({ name: world.metadata.name, worldJson, updatedAt }) // createdAt no cambia
        .where(eq(games.id, world.id))
        .returning({ id: games.id }),
    );
    if (updated.length === 0) throw new WorldNotFoundError(world.id);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.run(() =>
      this.db.delete(games).where(eq(games.id, id)).returning({ id: games.id }),
    );
    if (deleted.length === 0) throw new WorldNotFoundError(id);
  }

  async list(): Promise<WorldSummary[]> {
    // No se lee world_json: listar no necesita cargar los Worlds completos
    const rows = await this.run(() =>
      this.db
        .select({ id: games.id, name: games.name, updatedAt: games.updatedAt })
        .from(games)
        .orderBy(desc(games.updatedAt)),
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  // Los errores del driver (DrizzleQueryError, PostgresError...) nunca salen de aquí:
  // la aplicación solo conoce PersistenceError y sus subclases.
  private async run<T>(operation: () => PromiseLike<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError(STORAGE_UNAVAILABLE_MESSAGE, { cause: error });
    }
  }
}
