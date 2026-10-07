import type { World } from "../../domain/world/world";
import type { WorldRealtimePublisher } from "../../application/realtime/ports";
import {
  WORLD_UPDATED,
  buildWorldUpdated,
  worldChannelName,
} from "../../application/realtime/worldUpdate";

/** Lo mínimo que se usa del SDK de servidor (facilita sustituirlo en tests). */
export interface PusherTrigger {
  trigger(channel: string, event: string, data: unknown): Promise<unknown>;
}

export class PusherWorldPublisher implements WorldRealtimePublisher {
  constructor(private readonly pusher: PusherTrigger) {}

  async publishWorldUpdated(world: World): Promise<void> {
    await this.pusher.trigger(
      worldChannelName(world.id),
      WORLD_UPDATED,
      buildWorldUpdated(world),
    );
  }
}

/** Sin configuración de Pusher la partida sigue funcionando; solo no hay difusión en vivo. */
export class NoopWorldPublisher implements WorldRealtimePublisher {
  async publishWorldUpdated(): Promise<void> {}
}
