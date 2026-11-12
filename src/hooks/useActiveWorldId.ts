"use client";

import { useEffect, useState } from "react";
import {
  ActiveWorldWatcher,
  type ActiveWorldSource,
} from "@/application/realtime/ActiveWorldWatcher";

interface Deps {
  source: ActiveWorldSource;
  pollIntervalMs?: number;
}

export type ActiveWorldPhase = "loading" | "none" | "error" | "ready";

// Id de la partida activa (la que el Master tiene abierta). Solo lectura.
export function useActiveWorldId({ source, pollIntervalMs = 3000 }: Deps) {
  const [state, setState] = useState<{
    worldId: string | null;
    settled: boolean;
    failed: boolean;
  }>({ worldId: null, settled: false, failed: false });

  useEffect(
    () =>
      new ActiveWorldWatcher({
        source,
        pollIntervalMs,
        onActive: (worldId) =>
          setState({ worldId, settled: true, failed: false }),
        onError: () =>
          setState((prev) => ({ ...prev, settled: true, failed: true })),
      }).start(),
    [source, pollIntervalMs],
  );

  const phase: ActiveWorldPhase = state.worldId
    ? "ready"
    : !state.settled
      ? "loading"
      : state.failed
        ? "error"
        : "none";

  return { worldId: state.worldId, phase };
}
