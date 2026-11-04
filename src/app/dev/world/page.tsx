"use client";

import { useEffect, useMemo, useState } from "react";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";
import { useWorldEngine } from "@/hooks/useWorldEngine";
import type { Command } from "@/domain/events/command";
import { DEFAULT_SCENARIO, DEV_SCENARIOS } from "./scenarios";
import { BuildingLayoutEngine } from "@/engine/layout/BuildingLayoutEngine";
import { layoutVerdict, validateLayout } from "@/engine/layout/validateLayout";
import { analyzeRelations } from "@/engine/spatial/relationAnalysis";

// Ruta ÚNICA de desarrollo del motor visual (no es el Master ni el Display de una partida real).
// Estado local con WorldEngine; nada se persiste ni se publica.
const ZERO = { x: 0, y: 0, z: 0 };
let sequence = 0; // ids únicos de los elementos de prueba
const nextId = (prefix: string) => `${prefix}-${++sequence}`;

interface Action {
  label: string;
  needsArea?: boolean;
  onClick: () => void;
}

export default function DevWorldPage() {
  const { world, loadWorld, execute } = useWorldEngine();
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const scenario =
    DEV_SCENARIOS.find((s) => s.id === scenarioId) ?? DEFAULT_SCENARIO;

  useEffect(() => {
    loadWorld(scenario.build());
  }, [loadWorld, scenario]);

  // Diagnóstico espacial: mismo motor (determinista) que usa el canvas; solo informativo.
  const report = useMemo(() => {
    if (!world) return null;
    const issues = validateLayout(new BuildingLayoutEngine().compute(world), {
      analysis: analyzeRelations(world.areas),
    });
    return { verdict: layoutVerdict(issues), issues };
  }, [world]);

  if (process.env.NODE_ENV === "production") return <p>No disponible</p>;

  const run = (command: Command) => {
    const r = execute(command);
    setMessage(r.ok ? "Comando aplicado" : `Error: ${r.error.message}`);
  };

  const inSelected = () =>
    world?.entities.filter((e) => e.areaId === selected) ?? [];

  const addEntities = (type: string, n: number) => {
    if (!selected) return;
    for (let i = 0; i < n; i++) {
      const id = nextId(type);
      run({
        type: "ADD_ENTITY",
        entity: {
          id,
          type,
          name: id,
          areaId: selected,
          localPosition: ZERO,
          state: {},
        },
      });
    }
  };

  const setCondition = (value: string) => {
    const last = inSelected().at(-1);
    if (last) {
      run({
        type: "SET_STATE",
        targetType: "ENTITY",
        targetId: last.id,
        key: "condition",
        value,
      });
    }
  };

  const addRole = (roleDefinitionId: string) => {
    if (!selected) return;
    const id = nextId("rol");
    run({
      type: "ADD_ROLE",
      role: {
        id,
        roleDefinitionId,
        name: id,
        areaId: selected,
        localPosition: ZERO,
      },
    });
  };

  const setAreaState = (key: string, value: string) => {
    if (selected) {
      run({
        type: "SET_STATE",
        targetType: "AREA",
        targetId: selected,
        key,
        value,
      });
    }
  };

  // Una acción = un único botón; sin controles anidados.
  const actions: Action[] = [
    {
      label: "+ Área",
      onClick: () =>
        run({
          type: "ADD_AREA",
          area: {
            id: nextId("area-extra"),
            type: "custom",
            name: "Área extra",
            relations: [],
            state: {},
          },
        }),
    },
    {
      label: "+ Máquina",
      needsArea: true,
      onClick: () => addEntities("machine", 1),
    },
    {
      label: "+ 10 máquinas",
      needsArea: true,
      onClick: () => addEntities("machine", 10),
    },
    {
      label: "+ Pallet",
      needsArea: true,
      onClick: () => addEntities("pallet", 1),
    },
    {
      label: "+ Camión",
      needsArea: true,
      onClick: () => addEntities("truck", 1),
    },
    {
      label: "+ Tipo sin asset",
      needsArea: true,
      onClick: () => addEntities("unknown_machine", 1),
    },
    {
      label: "− Última entidad",
      needsArea: true,
      onClick: () => {
        const last = inSelected().at(-1);
        if (last) run({ type: "REMOVE_ENTITY", entityId: last.id });
      },
    },
    {
      label: "Última entidad: damaged",
      needsArea: true,
      onClick: () => setCondition("damaged"),
    },
    {
      label: "Última entidad: broken",
      needsArea: true,
      onClick: () => setCondition("broken"),
    },
    {
      label: "Última entidad: normal",
      needsArea: true,
      onClick: () => setCondition("normal"),
    },
    {
      label: "+ Operario (con asset)",
      needsArea: true,
      onClick: () => addRole("role-op"),
    },
    {
      label: "+ Guardia (sin asset)",
      needsArea: true,
      onClick: () => addRole("role-guard"),
    },
    {
      label: "Mover Director aquí",
      needsArea: true,
      onClick: () =>
        selected &&
        run({
          type: "MOVE_ROLE",
          roleInstanceId: "director",
          targetAreaId: selected,
        }),
    },
    {
      label: "Apagar luz",
      needsArea: true,
      onClick: () => setAreaState("lighting", "off"),
    },
    {
      label: "Encender luz",
      needsArea: true,
      onClick: () => setAreaState("lighting", "on"),
    },
    {
      label: "Estado CRISIS",
      needsArea: true,
      onClick: () => setAreaState("currentState", "CRISIS"),
    },
  ];

  const btn =
    "w-full rounded bg-slate-700 px-3 py-2 text-left text-sm text-white hover:bg-slate-600 disabled:opacity-40";

  return (
    <div className="flex h-screen bg-slate-900">
      <aside className="w-72 space-y-2 overflow-y-auto p-4 text-white">
        <h1 className="font-bold">Dev: motor visual</h1>
        <p className="text-xs text-slate-300">
          Área seleccionada: {selected ?? "ninguna (clic en un área)"}
        </p>

        <label className="block text-xs text-slate-300" htmlFor="scenario">
          Escenario
        </label>
        <select
          id="scenario"
          className="w-full rounded bg-slate-800 px-2 py-2 text-sm text-white"
          value={scenarioId}
          onChange={(e) => {
            setScenarioId(e.target.value);
            setSelected(null);
          }}
        >
          {DEV_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={btn}
          onClick={() => {
            loadWorld(scenario.build());
            setSelected(null);
          }}
        >
          Reiniciar escenario
        </button>

        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={btn}
            disabled={a.needsArea && !selected}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
        <p className="text-xs text-amber-300" role="status">
          {message}
        </p>
        {report && (
          <section aria-label="Validación espacial" className="text-xs">
            <h2 className="font-bold">Validación: {report.verdict}</h2>
            <ul className="space-y-1">
              {report.issues.map((i, n) => (
                <li
                  key={`${i.code}-${i.relationId ?? i.subject}-${n}`}
                  className={
                    i.severity === "error"
                      ? "text-red-300"
                      : i.severity === "warning"
                        ? "text-amber-300"
                        : "text-slate-400"
                  }
                >
                  [{i.severity}/{i.category}] {i.code}: {i.message}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <main className="flex-1">
        {world && (
          <PixiWorldCanvas world={world} onAreaSelected={setSelected} />
        )}
      </main>
    </div>
  );
}
