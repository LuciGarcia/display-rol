import PusherServer from "pusher";
import PusherClient from "pusher-js";

// Servidor (para emitir cambios desde las API Routes)
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID || "mock",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "mock",
  secret: process.env.PUSHER_SECRET || "mock",
  cluster: process.env.PUSHER_CLUSTER || "us2",
  useTLS: true,
});

// Cliente (para escuchar eventos en las pantallas)
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY || "mock",
  {
    cluster: process.env.PUSHER_CLUSTER || "us2",
  },
);
