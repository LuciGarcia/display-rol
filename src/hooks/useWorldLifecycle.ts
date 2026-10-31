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

export type OperationType = "guardar" | "cargar" | "listar" | "borrar";
export type SaveState = "idle" | "saving" | "saved" | "error";

export interface WorldFailure {
  operation: OperationType;
  message: string;
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
  const [failure, setFailure] = useState<WorldFailure | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const autosave = useMemo(() => new WorldAutosave(service), [service]);

  const refresh = useCallback(async () => {
    try {
      setSavedGames(await service.list());
      setFailure(null);
    } catch (e) {
      setFailure({ operation: "listar", message: messageOf(e) });
    }
  }, [service]);

  useEffect(() => {
    if (!world) return;
    setSaveState("saving");
    autosave
      .notify(world)
      .then((outcome) => {
        if (outcome === "saved") {
          setSaveState("saved");
          setFailure(null);
          return refresh();
        }
        if (outcome === "skipped" || outcome === "debounced") {
          setSaveState("idle");
        }
      })
      .catch((e) => {
        setFailure({ operation: "guardar", message: messageOf(e) });
        setSaveState("error");
      });
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
        setFailure(null);
      } catch (e) {
        setFailure({ operation: "cargar", message: messageOf(e) });
      }
    },
    [service, autosave, loadWorld],
  );

  const deleteGame = useCallback(
    async (id: string) => {
      try {
        await service.remove(id);
        setFailure(null);
      } catch (e) {
        setFailure({ operation: "borrar", message: messageOf(e) });
      }
      await refresh();
    },
    [service, refresh],
  );

  const retrySave = useCallback(async () => {
    if (!world) return;
    setSaveState("saving");
    try {
      await autosave.retry(world);
      setSaveState("saved");
      setFailure(null);
      await refresh();
    } catch (e) {
      setFailure({ operation: "guardar", message: messageOf(e) });
      setSaveState("error");
    }
  }, [world, autosave, refresh]);

  return {
    savedGames,
    error: failure?.message ?? null,
    failure,
    saveState,
    retrySave,
    loadGame,
    deleteGame,
  };
}
