"use client";

import { useEffect, useState } from "react";
import type { World } from "@/domain/world/world";
import type {
  RealtimeStatus,
  WorldRealtimeSubscriber,
} from "@/application/realtime/ports";
import { WorldSync, type WorldReader } from "@/application/realtime/WorldSync";
import { WorldNotFoundError } from "@/application/persistence/errors";

interface Deps {
  worldId: string;
  subscriber: WorldRealtimeSubscriber;
  reader: WorldReader;
  pollIntervalMs?: number;
}

export type SyncPhase = "loading" | "not-found" | "error" | "ready";

export function useWorldSync({
  worldId,
  subscriber,
  reader,
  pollIntervalMs = 5000,
}: Deps) {
  // El estado va etiquetado con worldId: al cambiar de partida el anterior se ignora.
  const [state, setState] = useState<{
    key: string;
    world: World | null;
    readError: unknown;
    settled: boolean;
  }>({ key: worldId, world: null, readError: null, settled: false });
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    const patch = (p: Partial<typeof state>) =>
      setState((prev) =>
        prev.key === worldId
          ? { ...prev, ...p }
          : {
              key: worldId,
              world: null,
              readError: null,
              settled: false,
              ...p,
            },
      );
    return new WorldSync({
      worldId,
      subscriber,
      reader,
      pollIntervalMs,
      onWorld: (world) => patch({ world }),
      onStatus: setStatus,
      onReadOk: () => patch({ readError: null, settled: true }),
      onReadError: (readError) => patch({ readError, settled: true }),
    }).start();
  }, [worldId, subscriber, reader, pollIntervalMs]);

  const current = state.key === worldId ? state : null;
  const world = current?.world ?? null;
  const readError = current?.readError ?? null;
  const settled = current?.settled ?? false;

  const phase: SyncPhase = world
    ? "ready"
    : !settled
      ? "loading"
      : readError instanceof WorldNotFoundError
        ? "not-found"
        : readError
          ? "error"
          : "loading";

  return { world, status, phase };
}
