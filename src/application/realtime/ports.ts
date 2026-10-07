import type { World } from "../../domain/world/world";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

// Estado técnico de la conexión; no es una representación del dominio.

/** Lado Master/servidor: distribuye un World ya persistido. */
export interface WorldRealtimePublisher {
  publishWorldUpdated(world: World): Promise<void>;
}

export interface WorldSubscriptionHandlers {
  /** Payload crudo y no confiable; lo valida quien lo consume. */
  onPayload(payload: unknown): void;
  onStatus(status: RealtimeStatus): void;
}

/** Lado Player: escucha el canal de una partida. Devuelve la función para cancelar. */
export interface WorldRealtimeSubscriber {
  subscribe(worldId: string, handlers: WorldSubscriptionHandlers): () => void;
}
