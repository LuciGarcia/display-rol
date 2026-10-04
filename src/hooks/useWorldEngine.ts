"use client";

import { useCallback, useRef, useState } from "react";
import { WorldEngine } from "@/engine/world/worldEngine";
import { simulateCommands } from "@/engine/world/simulateCommands";
import type { World } from "@/domain/world/world";
import type { Command } from "@/domain/events/command";
import type { WorldEvent } from "@/domain/events/event";

export type ExecuteResult =
  | { ok: true; event: WorldEvent }
  | { ok: false; error: Error };

export type ExecuteBatchResult =
  | { ok: true; events: WorldEvent[] }
  | { ok: false; failedIndex: number; error: Error };

export function useWorldEngine() {
  // El engine vive en un ref: es la autoridad. React solo guarda snapshots.
  const engineRef = useRef<WorldEngine | null>(null);
  const [world, setWorld] = useState<World | null>(null);

  const loadWorld = useCallback((initial: World) => {
    const engine = new WorldEngine(initial);
    engineRef.current = engine;
    setWorld(engine.getWorld());
  }, []);

  const clearWorld = useCallback(() => {
    engineRef.current = null;
    setWorld(null);
  }, []);

  const execute = useCallback((command: Command): ExecuteResult => {
    const engine = engineRef.current;
    if (!engine)
      return { ok: false, error: new Error("World no inicializado") };
    try {
      const event = engine.executeCommand(command);
      setWorld(engine.getWorld()); // snapshot nuevo => React detecta el cambio
      return { ok: true, event };
    } catch (error) {
      // Si falla, el World y el EventLog no cambian: no se actualiza el estado
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, []);

  // Aplica un lote de comandos de forma atómica (todo o nada).
  const executeBatch = useCallback(
    (commands: readonly Command[]): ExecuteBatchResult => {
      const engine = engineRef.current;
      if (!engine) {
        return {
          ok: false,
          failedIndex: -1,
          error: new Error("World no inicializado"),
        };
      }
      // Ensayo en seco sobre una copia: si algún comando falla, el World real no se toca
      const sim = simulateCommands(engine.getWorld(), commands);
      if (!sim.ok) {
        return { ok: false, failedIndex: sim.failedIndex, error: sim.error };
      }
      const events = commands.map((c) => engine.executeCommand(c));
      setWorld(engine.getWorld());
      return { ok: true, events };
    },
    [],
  );

  return { world, loadWorld, clearWorld, execute, executeBatch };
}
