import type { World } from "../../domain/world/world";
import type {
  WorldRepository,
  WorldSummary,
} from "../persistence/WorldRepository";
import type { WorldRealtimePublisher } from "./ports";

// Decorador: la persistencia sigue siendo la autoridad y el tiempo real solo distribuye.
//   persistir OK  → publicar (si publicar falla, el World ya está guardado y no se revierte)
//   persistir FALLA → no se publica nada
export class PublishingWorldRepository implements WorldRepository {
  constructor(
    private readonly inner: WorldRepository,
    private readonly publisher: WorldRealtimePublisher,
    private readonly onPublishError: (error: unknown) => void = (error) =>
      console.error(
        "Tiempo real: no se pudo publicar la actualización",
        error instanceof Error ? error.name : "desconocido",
      ),
  ) {}

  async create(world: World): Promise<void> {
    await this.inner.create(world);
    await this.publish(world);
  }

  async save(world: World): Promise<void> {
    await this.inner.save(world);
    await this.publish(world);
  }

  getById(id: string): Promise<World> {
    return this.inner.getById(id);
  }

  delete(id: string): Promise<void> {
    return this.inner.delete(id);
  }

  list(): Promise<WorldSummary[]> {
    return this.inner.list();
  }

  private async publish(world: World): Promise<void> {
    try {
      await this.publisher.publishWorldUpdated(world);
    } catch (error) {
      this.onPublishError(error);
    }
  }
}
