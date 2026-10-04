"use client";

import { useCallback, useState } from "react";
import type { World } from "@/domain/world/world";
import type { Command } from "@/domain/events/command";
import type { ExecuteBatchResult } from "@/hooks/useWorldEngine";
import { simulateCommands } from "@/engine/world/simulateCommands";
import {
  compileOperations,
  createEmptyWorld,
} from "@/application/ai/compileOperations";
import {
  InterpretResponseSchema,
  type AIProposal,
} from "@/application/ai/proposal";
import {
  buildWorldContext,
  EMPTY_WORLD_CONTEXT,
} from "@/application/ai/worldContext";
import {
  buildRoleSpawnCommands,
  toRoleDefinitions,
  type SetupRole,
} from "@/application/world/spawnRoles";

export interface InterpretOptions {
  // Solo en modo "generate": roles que el Master configuró para la partida.
  roles?: readonly SetupRole[];
}

type OkProposal = Extract<AIProposal, { status: "ok" }>;

export type AIErrorKind =
  | "network"
  | "request"
  | "provider"
  | "parse"
  | "proposal"
  | "domain"
  | "unknown";

export type AIInstructionState =
  | { phase: "idle" }
  | { phase: "loading" }
  | {
      phase: "preview";
      proposal: OkProposal;
      commands: Command[];
      generatedWorld: World | null;
    }
  | { phase: "clarification"; message: string }
  | { phase: "applied"; summary: string }
  | { phase: "error"; kind: AIErrorKind; message: string };

const toError = (kind: AIErrorKind, message: string): AIInstructionState => ({
  phase: "error",
  kind,
  message,
});

const failureMessage = (failedIndex: number, message: string): string =>
  failedIndex >= 0
    ? `La operación ${failedIndex + 1} fue rechazada: ${message}`
    : message;

interface Deps {
  world: World | null;
  loadWorld: (world: World) => void;
  executeBatch: (commands: readonly Command[]) => ExecuteBatchResult;
}

export function useAIInstruction({ world, loadWorld, executeBatch }: Deps) {
  const [state, setState] = useState<AIInstructionState>({ phase: "idle" });

  const interpret = useCallback(
    async (
      instruction: string,
      mode: "modify" | "generate" = "modify",
      options: InterpretOptions = {},
    ) => {
      if (mode === "modify" && !world) {
        return setState(
          toError("request", "No hay un mundo cargado para modificar."),
        );
      }
      setState({ phase: "loading" });

      let json: unknown;
      try {
        const res = await fetch("/api/ai/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction,
            mode,
            context:
              mode === "modify" && world
                ? buildWorldContext(world)
                : EMPTY_WORLD_CONTEXT,
          }),
        });
        json = await res.json();
      } catch {
        return setState(
          toError("network", "No se pudo contactar al servidor."),
        );
      }

      const parsed = InterpretResponseSchema.safeParse(json);
      if (!parsed.success)
        return setState(
          toError("unknown", "Respuesta inesperada del servidor."),
        );
      if (!parsed.data.ok)
        return setState(toError(parsed.data.kind, parsed.data.message));

      const proposal = parsed.data.proposal;
      if (proposal.status === "needs_clarification") {
        return setState({ phase: "clarification", message: proposal.message });
      }

      const roles = mode === "generate" ? (options.roles ?? []) : [];
      const base =
        mode === "generate"
          ? proposal.world
            ? createEmptyWorld(
                proposal.world,
                new Date(),
                toRoleDefinitions(roles),
              )
            : null
          : world;
      if (!base)
        return setState(
          toError("proposal", "La propuesta no define el mundo a crear."),
        );

      try {
        let commands = compileOperations(proposal.operations, base);
        let sim = simulateCommands(base, commands);
        if (sim.ok && roles.length > 0) {
          // Los roles del Master se ubican por reglas deterministas, no por la IA
          commands = [...commands, ...buildRoleSpawnCommands(sim.world, roles)];
          sim = simulateCommands(base, commands);
        }
        if (!sim.ok) {
          return setState(
            toError(
              "domain",
              `La operación ${sim.failedIndex + 1} (${sim.command.type}) fue rechazada: ${sim.error.message}`,
            ),
          );
        }
        setState({
          phase: "preview",
          proposal,
          commands,
          generatedWorld: mode === "generate" ? sim.world : null,
        });
      } catch (error) {
        setState(
          toError(
            "domain",
            error instanceof Error
              ? error.message
              : "No se pudo compilar la propuesta.",
          ),
        );
      }
    },
    [world],
  );

  const apply = useCallback(() => {
    if (state.phase !== "preview") return;
    if (state.generatedWorld) {
      loadWorld(state.generatedWorld);
    } else {
      const result = executeBatch(state.commands); // WorldEngine valida y ejecuta (todo o nada)
      if (!result.ok) {
        return setState(
          toError(
            "domain",
            failureMessage(result.failedIndex, result.error.message),
          ),
        );
      }
    }
    setState({ phase: "applied", summary: state.proposal.summary });
  }, [state, loadWorld, executeBatch]);

  const discard = useCallback(() => setState({ phase: "idle" }), []);

  return { state, interpret, apply, discard };
}
