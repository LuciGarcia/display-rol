import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World } from "../../domain/world/world";
import { WorldEngine } from "../../engine/world/worldEngine";

describe("FASE 2 — Test de Integración: Escenario Industrial Completo", () => {
  const createIndustrialWorld = (): World => ({
    id: "world_factory_01",
    metadata: {
      name: "Fábrica Industrial",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    environment: {
      id: "env_factory",
      type: "industrial_factory",
      name: "Fabrica de Manufactura",
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
        state: { inventory: 50, lighting: "on" },
      },
    ],
    entities: [],
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
        localPosition: { x: 0, y: 0, z: 0 },
      },
    ],
    state: {},
  });

  it("Ejecuta la secuencia completa de simulación sin errores", () => {
    const engine = new WorldEngine(createIndustrialWorld());

    // 1. Director se mueve de office a production_floor
    const event1 = engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "director",
      targetAreaId: "production_floor",
    });
    assert.equal(event1.type, "ROLE_MOVED");

    // 2. Apagar luces en warehouse
    const event2 = engine.executeCommand({
      type: "SET_STATE",
      targetType: "AREA",
      targetId: "warehouse",
      key: "lighting",
      value: "off",
    });
    assert.equal(event2.type, "STATE_CHANGED");

    // 3. Agregar maquina en production_floor
    const event3 = engine.executeCommand({
      type: "ADD_ENTITY",
      entity: {
        id: "machine_01",
        type: "machine",
        name: "Torno CNC",
        areaId: "production_floor",
        localPosition: { x: 5, y: 5, z: 0 },
        state: { status: "idle" },
      },
    });
    assert.equal(event3.type, "ENTITY_ADDED");

    // 4. Eliminar maquina
    const event4 = engine.executeCommand({
      type: "REMOVE_ENTITY",
      entityId: "machine_01",
    });
    assert.equal(event4.type, "ENTITY_REMOVED");

    // Verificación de Estado Final
    const finalWorld = engine.getWorld();
    assert.equal(
      finalWorld.roleInstances.find((r) => r.id === "director")?.areaId,
      "production_floor",
    );
    assert.equal(
      finalWorld.areas.find((a) => a.id === "warehouse")?.state.lighting,
      "off",
    );
    assert.equal(finalWorld.entities.length, 0);

    // Verificación de Historial de Eventos
    const history = engine.getEventHistory();
    assert.equal(history.length, 4);
    assert.equal(history[0].type, "ROLE_MOVED");
    assert.equal(history[1].type, "STATE_CHANGED");
    assert.equal(history[2].type, "ENTITY_ADDED");
    assert.equal(history[3].type, "ENTITY_REMOVED");
  });
});
