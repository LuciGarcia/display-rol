import type {
  RealtimeStatus,
  WorldRealtimeSubscriber,
  WorldSubscriptionHandlers,
} from "../../application/realtime/ports";
import {
  WORLD_UPDATED,
  worldChannelName,
} from "../../application/realtime/worldUpdate";

/** Lo mínimo que se usa del SDK de navegador (facilita sustituirlo en tests). */
export interface PusherChannelLike {
  bind(event: string, callback: (data: unknown) => void): unknown;
}
export interface PusherClientLike {
  subscribe(channel: string): PusherChannelLike;
  unsubscribe(channel: string): void;
  disconnect(): void;
  connection: {
    bind(event: string, callback: (change: { current: string }) => void): unknown;
  };
}

// "connected" del socket no implica suscripción lista: eso lo marca subscription_succeeded.
function statusOf(connectionState: string): RealtimeStatus | null {
  switch (connectionState) {
    case "initialized":
    case "connecting":
      return "connecting";
    case "unavailable":
    case "failed":
    case "disconnected":
      return "disconnected";
    default:
      return null;
  }
}

// Una conexión por suscripción: se cierra al cancelar (compatible con el doble efecto de React).
export class PusherWorldSubscriber implements WorldRealtimeSubscriber {
  constructor(private readonly createClient: () => PusherClientLike) {}

  subscribe(worldId: string, handlers: WorldSubscriptionHandlers): () => void {
    const client = this.createClient();
    const channelName = worldChannelName(worldId);

    client.connection.bind("state_change", ({ current }) => {
      const status = statusOf(current);
      if (status) handlers.onStatus(status);
    });
    const channel = client.subscribe(channelName);
    channel.bind("pusher:subscription_succeeded", () =>
      handlers.onStatus("connected"),
    );
    channel.bind(WORLD_UPDATED, (payload) => handlers.onPayload(payload));
    handlers.onStatus("connecting");

    return () => {
      client.unsubscribe(channelName);
      client.disconnect();
    };
  }
}

/** Sin clave pública no hay conexión en vivo; el Player igual carga el World persistido. */
export class OfflineWorldSubscriber implements WorldRealtimeSubscriber {
  subscribe(_worldId: string, handlers: WorldSubscriptionHandlers): () => void {
    handlers.onStatus("disconnected");
    return () => {};
  }
}
