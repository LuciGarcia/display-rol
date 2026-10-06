"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { World } from "@/domain/world/world";
import type { WorldLifecycleService } from "@/application/persistence/WorldLifecycleService";
import type { WorldSummary } from "@/application/persistence/WorldRepository";
import { WorldAutosave } from "@/application/persistence/WorldAutosave";
import {
  PersistenceError,
  STORAGE_UNAVAILABLE_MESSAGE,
} from "@/application/persistence/errors";

interface Deps {
  world: World | null;
  loadWorld: (world: World) => void;
  service: WorldLifecycleService;
}

// Solo los errores de persistencia tienen mensajes pensados para el usuario
const messageOf = (error: unknown): string =>
  error instanceof PersistenceError
    ? error.message
    : STORAGE_UNAVAILABLE_MESSAGE;

// Ciclo de vida del World en React: pegamento entre useWorldEngine y la capa de aplicación.
// Cuándo se guarda lo decide WorldAutosave; este hook solo le notifica cada snapshot nuevo.
export function useWorldLifecycle({ world, loadWorld, service }: Deps) {
  const [savedGames, setSavedGames] = useState<WorldSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const autosave = useMemo(() => new WorldAutosave(service), [service]);

  const refresh = useCallback(async () => {
    try {
      setSavedGames(await service.list());
    } catch (e) {
      setError(messageOf(e));
    }
  }, [service]);

  useEffect(() => {
    if (!world) return;
    autosave
      .notify(world)
      .then((outcome) => {
        if (outcome === "saved") {
          setError(null);
          return refresh();
        }
      })
      .catch((e) => setError(messageOf(e)));
  }, [world, autosave, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadGame = useCallback(
    async (id: string) => {
      try {
        const loaded = await service.load(id);
        autosave.markLoaded(loaded); // cargar no debe producir un guardado
        loadWorld(loaded);
        setError(null);
      } catch (e) {
        setError(messageOf(e));
      }
    },
    [service, autosave, loadWorld],
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
