import type { World } from "../../domain/world/world";
import type { WorldRepository } from "../persistence/WorldRepository";
import type { RealtimeStatus, WorldRealtimeSubscriber } from "./ports";
import {
  isNewerTimestamp,
  isNewerWorld,
  parseWorldUpdated,
} from "./worldUpdate";

/** El Player solo necesita leer. */
export type WorldReader = Pick<WorldRepository, "getById">;

export interface WorldSyncDeps {
  worldId: string;
  subscriber: WorldRealtimeSubscriber;
  reader: WorldReader;
  onWorld(world: World): void;
  onStatus?(status: RealtimeStatus): void;
  onError?(error: unknown): void;
}

// Lado Player. Mantiene un World local de solo lectura:
//   snapshot inicial (persistencia) + mensajes realtime → validar → ordenar → entregar.
// No se confía en que ningún mensaje se haya perdido: al (re)conectar se vuelve a leer el
// World persistido. Un snapshot viejo nunca reemplaza a uno más nuevo (metadata.updatedAt).
export class WorldSync {
  private current: World | null = null;
  private stopped = false;

  constructor(private readonly deps: WorldSyncDeps) {}

  start(): () => void {
    this.stopped = false;
    const unsubscribe = this.deps.subscriber.subscribe(this.deps.worldId, {
      onPayload: (payload) => this.receive(payload),
      onStatus: (status) => {
        if (this.stopped) return;
        this.deps.onStatus?.(status);
        if (status === "connected") void this.resync(); // cubre reconexiones
      },
    });
    void this.resync(); // no depende de que llegue un evento
    return () => {
      this.stopped = true;
      unsubscribe();
    };
  }

  private receive(payload: unknown): void {
    if (this.stopped) return;
    const parsed = parseWorldUpdated(payload, this.deps.worldId);
    if (!parsed.ok) {
      this.deps.onError?.(new Error(parsed.reason));
      return;
    }
    if (parsed.world) {
      this.accept(parsed.world);
    } else if (
      isNewerTimestamp(parsed.updatedAt, this.current?.metadata.updatedAt ?? null)
    ) {
      void this.resync(); // el snapshot no cabía en el mensaje: se lee de la persistencia
    }
  }

  private async resync(): Promise<void> {
    try {
      this.accept(await this.deps.reader.getById(this.deps.worldId));
    } catch (error) {
      this.deps.onError?.(error); // p. ej. la partida aún no existe: se espera el próximo evento
    }
  }

  private accept(world: World): void {
    if (this.stopped || world.id !== this.deps.worldId) return;
    if (!isNewerWorld(world, this.current)) return;
    this.current = world;
    this.deps.onWorld(world);
  }
}
