"use client";

import { useEffect, useRef, useState } from "react";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";
import { useWorldEngine } from "@/hooks/useWorldEngine";
import { WorldSchema, type World } from "@/domain/world/world";
import type { Command } from "@/domain/events/command";

const createScenario = (): World =>
  WorldSchema.parse({
    id: "dev-world",
    metadata: { name: "Escenario de prueba", createdAt: "x", updatedAt: "x" },
    environment: { id: "env", type: "industrial_factory", name: "Fábrica" },
    areas: [
      { id: "office", type: "office", name: "Oficina" },
      {
        id: "production_floor",
        type: "production_floor",
        name: "Planta de producción",
      },
      { id: "warehouse", type: "warehouse", name: "Depósito" },
    ],
    roleDefinitions: [
      { id: "role-director", name: "Director General" },
      { id: "role-op", name: "Operario" },
    ],
    roleInstances: [
      {
        id: "director",
        roleDefinitionId: "role-director",
        name: "Director General",
        areaId: "office",
      },
    ],
  });

const ZERO = { x: 0, y: 0, z: 0 };

export default function DevWorldPage() {
  const { world, loadWorld, execute } = useWorldEngine();
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const counter = useRef(0);
  const nextId = (prefix: string) => `${prefix}-${++counter.current}`;

  useEffect(() => {
    loadWorld(createScenario());
  }, [loadWorld]);

  if (process.env.NODE_ENV === "production") return <p>No disponible</p>;

  const run = (command: Command) => {
    const r = execute(command);
    setMessage(r.ok ? "Comando aplicado" : `Error: ${r.error.message}`);
  };

  const addMachines = (n: number) => {
    if (!selected) return;
    for (let i = 0; i < n; i++) {
      const id = nextId("machine");
      run({
        type: "ADD_ENTITY",
        entity: {
          id,
          type: "machine",
          name: id,
          areaId: selected,
          localPosition: ZERO,
          state: {},
        },
      });
    }
  };

  const removeLast = () => {
    const inArea = world?.entities.filter((e) => e.areaId === selected) ?? [];
    const last = inArea[inArea.length - 1];
    if (last) run({ type: "REMOVE_ENTITY", entityId: last.id });
  };

  const btn =
    "w-full rounded bg-slate-700 px-3 py-2 text-left text-sm text-white hover:bg-slate-600 disabled:opacity-40";
  const none = !selected;

  return (
    <div className="flex h-screen bg-slate-900">
      <aside className="w-72 space-y-2 overflow-y-auto p-4 text-white">
        <h1 className="font-bold">Dev: Layout Engine</h1>
        <p className="text-xs text-slate-300">
          Área seleccionada: {selected ?? "ninguna (clic en un área)"}
        </p>

        <button
          className={btn}
          onClick={() => {
            loadWorld(createScenario());
            setSelected(null);
          }}
        >
          Reiniciar escenario
        </button>
        <button
          className={btn}
          onClick={() =>
            run({
              type: "ADD_AREA",
              area: {
                id: nextId("area"),
                type: "custom",
                name: "Área extra",
                state: {},
              },
            })
          }
        >
          + Área
        </button>
        <button className={btn} disabled={none} onClick={() => addMachines(1)}>
          + Máquina
        </button>
        <button className={btn} disabled={none} onClick={() => addMachines(10)}>
          + 10 máquinas
        </button>
        <button className={btn} disabled={none} onClick={removeLast}>
          − Última entidad
        </button>
        <button
          className={btn}
          disabled={none}
          onClick={() => {
            const id = nextId("op");
            run({
              type: "ADD_ROLE",
              role: {
                id,
                roleDefinitionId: "role-op",
                name: id,
                areaId: selected!,
                localPosition: ZERO,
              },
            });
          }}
        >
          + Rol (Operario)
        </button>
        <button
          className={btn}
          disabled={none}
          onClick={() =>
            run({
              type: "MOVE_ROLE",
              roleInstanceId: "director",
              targetAreaId: selected!,
            })
          }
        >
          Mover Director aquí
        </button>
        <button
          className={btn}
          disabled={none}
          onClick={() =>
            run({
              type: "SET_STATE",
              targetType: "AREA",
              targetId: selected!,
              key: "lighting",
              value: "off",
            })
          }
        >
          Apagar luz
        </button>
        <button
          className={btn}
          disabled={none}
          onClick={() =>
            run({
              type: "SET_STATE",
              targetType: "AREA",
              targetId: selected!,
              key: "lighting",
              value: "on",
            })
          }
        >
          Encender luz
        </button>
        <button
          className={btn}
          disabled={none}
          onClick={() =>
            run({
              type: "SET_STATE",
              targetType: "AREA",
              targetId: selected!,
              key: "currentState",
              value: "CRISIS",
            })
          }
        >
          Estado CRISIS
        </button>
        <p className="text-xs text-amber-300">{message}</p>
      </aside>

      <main className="flex-1">
        {world && (
          <PixiWorldCanvas world={world} onAreaSelected={setSelected} />
        )}
      </main>
    </div>
  );
}
