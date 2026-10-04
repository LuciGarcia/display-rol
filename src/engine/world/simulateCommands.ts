import type { World } from "../../domain/world/world";
import type { Command } from "../../domain/events/command";
import type { WorldEvent } from "../../domain/events/event";
import { WorldEngine } from "./worldEngine";

export type SimulationResult =
  | { ok: true; world: World; events: WorldEvent[] }
  | { ok: false; failedIndex: number; command: Command; error: Error };

// Ensayo en seco de un lote sobre una copia: no modifica el World recibido.
// Permite aplicar el lote de forma atómica (todo o nada).
export function simulateCommands(
  world: World,
  commands: readonly Command[],
): SimulationResult {
  const engine = new WorldEngine(JSON.parse(JSON.stringify(world)));
  const events: WorldEvent[] = [];
  for (let i = 0; i < commands.length; i++) {
    try {
      events.push(engine.executeCommand(commands[i]));
    } catch (error) {
      return {
        ok: false,
        failedIndex: i,
        command: commands[i],
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
  return { ok: true, world: engine.getWorld(), events };
}
