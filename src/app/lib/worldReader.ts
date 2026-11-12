import type { WorldReader } from "@/application/realtime/WorldSync";
import type { ActiveWorldSource } from "@/application/realtime/ActiveWorldWatcher";
import { HttpWorldRepository } from "@/infrastructure/persistence/http/HttpWorldRepository";

// Lectura para el Display (solo lectura): un World por id y cuál es la partida activa.
const repository = new HttpWorldRepository();
export const worldReader: WorldReader = {
  getById: (id) => repository.getById(id),
};
export const activeWorldSource: ActiveWorldSource = {
  getActiveId: () => repository.getActiveId(),
};
