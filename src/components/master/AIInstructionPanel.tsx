"use client";

import { useState } from "react";
import type { Command } from "@/domain/events/command";
import type { AIErrorKind, AIInstructionState } from "@/hooks/useAIInstruction";

const ERROR_LABEL: Record<AIErrorKind, string> = {
  network: "Sin conexión con el servidor",
  request: "Petición inválida",
  provider: "Error del proveedor de IA",
  parse: "La IA devolvió algo que no es JSON",
  proposal: "La IA devolvió una propuesta inválida",
  domain: "El mundo rechazó la propuesta",
  unknown: "Error inesperado",
};

function describe(c: Command): string {
  switch (c.type) {
    case "MOVE_ROLE":
      return `Mover rol ${c.roleInstanceId} → ${c.targetAreaId}`;
    case "SET_STATE":
      return `Estado de ${c.targetType.toLowerCase()} ${c.targetId}: ${c.key} = ${JSON.stringify(c.value)}`;
    case "ADD_ENTITY":
      return `Agregar ${c.entity.type} "${c.entity.name}" en ${c.entity.areaId}`;
    case "REMOVE_ENTITY":
      return `Quitar entidad ${c.entityId}`;
    case "ADD_AREA":
      return `Agregar área "${c.area.name}"`;
    case "REMOVE_AREA":
      return `Quitar área ${c.areaId}`;
    case "ADD_ROLE":
      return `Agregar rol "${c.role.name}" en ${c.role.areaId}`;
    case "REMOVE_ROLE":
      return `Quitar rol ${c.roleInstanceId}`;
  }
}

interface Props {
  state: AIInstructionState;
  onInterpret: (instruction: string) => void;
  onApply: () => void;
  onDiscard: () => void;
}

export function AIInstructionPanel({
  state,
  onInterpret,
  onApply,
  onDiscard,
}: Props) {
  const [text, setText] = useState("");
  const loading = state.phase === "loading";

  return (
    <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 space-y-4">
      <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">
        Instrucción para la IA
      </h3>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder='Ej: "Agrega una máquina averiada en producción"'
          className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded text-xs text-white"
        />
        <button
          disabled={loading || !text.trim()}
          onClick={() => onInterpret(text)}
          className="px-4 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 font-bold rounded text-xs"
        >
          {loading ? "Interpretando…" : "Interpretar"}
        </button>
      </div>

      {state.phase === "preview" && (
        <div className="space-y-2 text-xs">
          <p className="font-semibold text-neutral-100">
            {state.proposal.summary}
          </p>
          <ul className="list-disc pl-5 text-neutral-300 space-y-0.5">
            {state.commands.map((c, i) => (
              <li key={i}>{describe(c)}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={onApply}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded font-bold"
            >
              Aplicar
            </button>
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded font-bold"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
      {state.phase === "clarification" && (
        <p className="text-xs text-amber-300">
          La IA necesita una aclaración: {state.message}
        </p>
      )}
      {state.phase === "applied" && (
        <p className="text-xs text-green-400">Aplicado: {state.summary}</p>
      )}
      {state.phase === "error" && (
        <p className="text-xs text-red-400">
          {ERROR_LABEL[state.kind]}: {state.message}
        </p>
      )}
    </div>
  );
}
