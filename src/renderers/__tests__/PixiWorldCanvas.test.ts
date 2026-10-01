import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World } from "../../domain/world/world";
import { WorldEngine } from "../../engine/world/worldEngine";

describe("FASE 3.2 — Pruebas de Contrato, Inmutabilidad y Flujo de Datos para el Componente Canvas", () => {
  const createTestWorld = (): World => ({
    id: "world_demo_01",
    metadata: {
      name: "Fábrica Demo",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    environment: {
      id: "env_factory",
      type: "industrial_factory",
      name: "Entorno Industrial",
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
        name: "Torno CNC",
        areaId: "production_floor",
        localPosition: { x: 20, y: 20, z: 0 },
        state: {},
      },
      {
        id: "pallet_01",
        type: "pallet",
        name: "Pallet Madera",
        areaId: "warehouse",
        localPosition: { x: 10, y: 10, z: 0 },
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
        localPosition: { x: 15, y: 15, z: 0 },
      },
    ],
    state: {},
  });

  it("1. El contrato del World entregado al componente es inmutable y válido", () => {
    const engine = new WorldEngine(createTestWorld());
    const worldBefore = engine.serialize();

    // Simulamos la lectura que hace el componente React
    const worldForProps = engine.getWorld();
    assert.equal(worldForProps.id, "world_demo_01");

    const worldAfter = engine.serialize();
    assert.equal(worldAfter, worldBefore);
  });

  it("2. Actualizar el World a través de WorldEngine genera una nueva referencia de estado para React", () => {
    const engine = new WorldEngine(createTestWorld());
    const initialWorld = engine.getWorld();

    assert.equal(initialWorld.roleInstances[0].areaId, "office");

    // Transición atómica en WorldEngine
    engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "director",
      targetAreaId: "production_floor",
    });

    const updatedWorld = engine.getWorld();
    assert.equal(updatedWorld.roleInstances[0].areaId, "production_floor");
    assert.notEqual(initialWorld, updatedWorld);
  });

  it("3. Invariante: Un comando fallido no genera variaciones de estado ni dispara re-renders inválidos", () => {
    const engine = new WorldEngine(createTestWorld());
    const initialWorldJson = engine.serialize();

    assert.throws(() => {
      engine.executeCommand({
        type: "MOVE_ROLE",
        roleInstanceId: "director",
        targetAreaId: "area_inexistente",
      });
    });

    assert.equal(engine.serialize(), initialWorldJson);
  });
});
