"use client";

import React, { useState, useMemo } from "react";
import { WorldEngine } from "@/engine/world/worldEngine";
import { World } from "@/domain/world/world";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";

const initialWorldData: World = {
  id: "world_industrial_demo",
  metadata: {
    name: "Planta de Producción San Rafael",
    description: "Demostración de Integración PixiJS + Dynamic World Engine",
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  environment: {
    id: "env_factory",
    type: "industrial_factory",
    name: "Fábrica Industrial",
    properties: {},
  },
  areas: [
    { id: "office", type: "office", name: "Oficina Central", state: {} },
    {
      id: "production_floor",
      type: "production_floor",
      name: "Planta de Producción",
      state: {},
    },
    {
      id: "warehouse",
      type: "warehouse",
      name: "Depósito Central",
      state: { lighting: "on" },
    },
  ],
  entities: [
    {
      id: "machine_01",
      type: "machine",
      name: "Torno CNC A1",
      areaId: "production_floor",
      localPosition: { x: 30, y: 40, z: 0 },
      state: {},
    },
    {
      id: "machine_02",
      type: "machine",
      name: "Prensa B2",
      areaId: "production_floor",
      localPosition: { x: 180, y: 40, z: 0 },
      state: {},
    },
    {
      id: "pallet_01",
      type: "pallet",
      name: "Pallet Madera #1",
      areaId: "warehouse",
      localPosition: { x: 20, y: 30, z: 0 },
      state: {},
    },
    {
      id: "pallet_02",
      type: "pallet",
      name: "Pallet Madera #2",
      areaId: "warehouse",
      localPosition: { x: 90, y: 30, z: 0 },
      state: {},
    },
  ],
  roleDefinitions: [
    {
      id: "role_def_director",
      name: "Director General",
      capabilities: ["manage", "authorize"],
    },
  ],
  roleInstances: [
    {
      id: "director",
      roleDefinitionId: "role_def_director",
      name: "Director General",
      areaId: "office",
      localPosition: { x: 40, y: 50, z: 0 },
    },
  ],
  state: {},
};

export default function PixiDemoPage() {
  // Instanciamos el WorldEngine como fuente de verdad única
  const engine = useMemo(() => new WorldEngine(initialWorldData), []);
  const [world, setWorld] = useState<World>(() => engine.getWorld());

  const handleMoveRole = (targetAreaId: string) => {
    engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "director",
      targetAreaId,
    });
    setWorld(engine.getWorld());
  };

  const handleToggleWarehouseLighting = () => {
    const currentArea = engine
      .getWorld()
      .areas.find((a) => a.id === "warehouse");
    const isLightingOff = currentArea?.state.lighting === "off";

    engine.executeCommand({
      type: "SET_STATE",
      targetType: "AREA",
      targetId: "warehouse",
      key: "lighting",
      value: isLightingOff ? "on" : "off",
    });
    setWorld(engine.getWorld());
  };

  const currentRoleArea = world.roleInstances.find(
    (r) => r.id === "director",
  )?.areaId;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        backgroundColor: "#1e293b",
        color: "#f8fafc",
      }}
    >
      <header
        style={{
          padding: "1rem",
          borderBottom: "1px solid #334155",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>
            Fase 3.2 — Dynamic World Engine + PixiJS Canvas
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
            Ubicación actual del Director: <strong>{currentRoleArea}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => handleMoveRole("office")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              backgroundColor:
                currentRoleArea === "office" ? "#2563eb" : "#475569",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Mover a Oficina
          </button>
          <button
            onClick={() => handleMoveRole("production_floor")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              backgroundColor:
                currentRoleArea === "production_floor" ? "#2563eb" : "#475569",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Mover a Planta
          </button>
          <button
            onClick={() => handleMoveRole("warehouse")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              backgroundColor:
                currentRoleArea === "warehouse" ? "#2563eb" : "#475569",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Mover a Depósito
          </button>
          <button
            onClick={handleToggleWarehouseLighting}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              backgroundColor: "#eab308",
              color: "#000",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Alternar Luz Depósito
          </button>
        </div>
      </header>

      <main style={{ flex: 1, position: "relative" }}>
        <PixiWorldCanvas world={world} />
      </main>
    </div>
  );
}
