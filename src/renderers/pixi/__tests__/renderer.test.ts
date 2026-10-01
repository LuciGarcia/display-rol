import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World } from "../../../domain/world/world";
import { WorldEngine } from "../../../engine/world/worldEngine";
import { PixiWorldRenderer } from "../PixiWorldRenderer";

describe("FASE 3.1 — Pruebas de Contrato e Inmutabilidad del Renderer", () => {
  const createMockWorld = (): World => ({
    id: "world_test",
    metadata: {
      name: "Mundo de Prueba Visual",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    environment: {
      id: "env_factory",
      type: "industrial_factory",
      name: "Fábrica de Prueba",
      properties: {},
    },
    areas: [
      { id: "office", type: "office", name: "Oficina", state: {} },
      {
        id: "production_floor",
        type: "production_floor",
        name: "Planta de Producción",
        state: {},
      },
      {
        id: "warehouse",
        type: "warehouse",
        name: "Depósito",
        state: { lighting: true },
      },
    ],
    entities: [
      {
        id: "machine-01",
        type: "machine",
        name: "Torno CNC",
        areaId: "production_floor",
        localPosition: { x: 10, y: 10, z: 0 },
        state: {},
      },
      {
        id: "pallet-01",
        type: "pallet",
        name: "Pallet Madera",
        areaId: "warehouse",
        localPosition: { x: 20, y: 20, z: 0 },
        state: {},
      },
    ],
    roleDefinitions: [
      {
        id: "role_def_director",
        name: "Director General",
        capabilities: ["manage"],
      },
    ],
    roleInstances: [
      {
        id: "director",
        roleDefinitionId: "role_def_director",
        name: "Director General",
        areaId: "office",
        localPosition: { x: 30, y: 30, z: 0 },
      },
    ],
    state: {},
  });

  it("Garantiza inmutabilidad estricta del World durante el proceso de renderizado", () => {
    const engine = new WorldEngine(createMockWorld());
    const worldBefore = engine.serialize();

    const renderer = new PixiWorldRenderer();
    renderer.render(engine.getWorld());

    const worldAfter = engine.serialize();
    assert.equal(worldAfter, worldBefore);
  });

  it("Refleja la nueva ubicación del Rol cuando el WorldEngine procesa MOVE_ROLE", () => {
    const engine = new WorldEngine(createMockWorld());
    const renderer = new PixiWorldRenderer();

    // Render 1
    renderer.render(engine.getWorld());
    assert.equal(engine.getWorld().roleInstances[0].areaId, "office");

    // Movimiento en el World Engine
    engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "director",
      targetAreaId: "production_floor",
    });

    // Render 2
    renderer.render(engine.getWorld());
    assert.equal(engine.getWorld().roleInstances[0].areaId, "production_floor");
  });
});
