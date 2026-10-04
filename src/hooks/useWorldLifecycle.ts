"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { World } from "@/domain/world/world";
import type { WorldLifecycleService } from "@/application/persistence/WorldLifecycleService";
import type { WorldSummary } from "@/application/persistence/WorldRepository";

interface Deps {
  world: World | null;
  loadWorld: (world: World) => void;
  service: WorldLifecycleService;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Error de persistencia desconocido.";

// Ciclo de vida del World: una única estrategia de guardado. Cada snapshot nuevo que
// emite useWorldEngine se persiste, sin lógica de guardado en cada handler de acción.
export function useWorldLifecycle({ world, loadWorld, service }: Deps) {
  const [savedGames, setSavedGames] = useState<WorldSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Cola: los guardados se aplican en el orden en que se generaron los snapshots
  const queue = useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(async () => {
    try {
      setSavedGames(await service.list());
    } catch (e) {
      setError(messageOf(e));
    }
  }, [service]);

  useEffect(() => {
    if (!world) return;
    queue.current = queue.current.then(async () => {
      try {
        await service.persist(world);
        setError(null);
        await refresh();
      } catch (e) {
        setError(messageOf(e));
      }
    });
  }, [world, service, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadGame = useCallback(
    async (id: string) => {
      try {
        loadWorld(await service.load(id));
        setError(null);
      } catch (e) {
        setError(messageOf(e));
      }
    },
    [service, loadWorld],
  );

  const deleteGame = useCallback(
    async (id: string) => {
      try {
        await service.remove(id);
        setError(null);
      } catch (e) {
        setError(messageOf(e));
      }
      await refresh();
    },
    [service, refresh],
  );

  return { savedGames, error, loadGame, deleteGame };
}
