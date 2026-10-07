"use client";

import { useEffect, useState } from "react";
import type { World } from "@/domain/world/world";
import type {
  RealtimeStatus,
  WorldRealtimeSubscriber,
} from "@/application/realtime/ports";
import { WorldSync, type WorldReader } from "@/application/realtime/WorldSync";

interface Deps {
  worldId: string;
  subscriber: WorldRealtimeSubscriber;
  reader: WorldReader;
}

// Hook del Player (solo lectura): entrega el último World válido y el estado de la conexión.
// El World resultante alimenta el pipeline normal: Layout → Assets → Pixi.
export function useWorldSync({ worldId, subscriber, reader }: Deps) {
  const [world, setWorld] = useState<World | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    setWorld(null);
    return new WorldSync({
      worldId,
      subscriber,
      reader,
      onWorld: setWorld,
      onStatus: setStatus,
      onError: () => {}, // payload inválido o partida aún inexistente: se ignora y se espera
    }).start();
  }, [worldId, subscriber, reader]);

  return { world, status };
}
