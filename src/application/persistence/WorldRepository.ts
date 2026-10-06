import type { World } from "../../domain/world/world";

// Resumen para listar partidas sin cargar ni exponer el World completo.
// Regla de timestamps: `updatedAt` es siempre `world.metadata.updatedAt` (lo mantiene el
// WorldEngine). Un adaptador no genera ni sobrescribe su propio "última modificación".
export interface WorldSummary {
  id: string;
  name: string;
  updatedAt: string;
}

// Puerto de persistencia. La unidad persistida es el World completo (nunca sus partes).
// Cada implementación (memoria hoy, base de datos mañana) cumple este contrato.
export interface WorldRepository {
  /** Guarda un World nuevo. Falla con WorldAlreadyExistsError si el id ya existe. */
  create(world: World): Promise<void>;
  /** Devuelve el World validado. WorldNotFoundError o InvalidPersistedWorldError si falla. */
  getById(id: string): Promise<World>;
  /** Reemplaza un World existente. Falla con WorldNotFoundError si no existe. */
  save(world: World): Promise<void>;
  /** Elimina un World. Falla con WorldNotFoundError si no existe. */
  delete(id: string): Promise<void>;
  /** Partidas guardadas, la modificada más recientemente primero. */
  list(): Promise<WorldSummary[]>;
}
