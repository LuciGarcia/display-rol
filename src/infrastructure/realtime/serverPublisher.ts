import Pusher from "pusher";
import type { WorldRealtimePublisher } from "../../application/realtime/ports";
import { NoopWorldPublisher, PusherWorldPublisher } from "./PusherWorldPublisher";

// SOLO SERVIDOR: lee el secreto de Pusher. Nunca debe importarse desde código de navegador.
export function createServerWorldPublisher(
  env: NodeJS.ProcessEnv = process.env,
): WorldRealtimePublisher {
  const appId = env.PUSHER_APP_ID;
  const secret = env.PUSHER_SECRET;
  const key = env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!appId || !secret || !key || !cluster) {
    console.warn("Tiempo real desactivado: faltan variables de Pusher");
    return new NoopWorldPublisher();
  }
  return new PusherWorldPublisher(
    new Pusher({ appId, key, secret, cluster, useTLS: true }),
  );
}
