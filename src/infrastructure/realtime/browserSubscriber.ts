import Pusher from "pusher-js";
import type { WorldRealtimeSubscriber } from "../../application/realtime/ports";
import {
  OfflineWorldSubscriber,
  PusherWorldSubscriber,
  type PusherClientLike,
} from "./PusherWorldSubscriber";

// NAVEGADOR: solo usa la clave pública y el cluster. El secreto vive únicamente en el servidor.
export function createBrowserWorldSubscriber(): WorldRealtimeSubscriber {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return new OfflineWorldSubscriber();
  return new PusherWorldSubscriber(
    () => new Pusher(key, { cluster }) as unknown as PusherClientLike,
  );
}
