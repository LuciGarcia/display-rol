import type { WorldReader } from "@/application/realtime/WorldSync";
import { HttpWorldRepository } from "@/infrastructure/persistence/http/HttpWorldRepository";

const repository = new HttpWorldRepository();
export const worldReader: WorldReader = {
  getById: (id) => repository.getById(id),
};
