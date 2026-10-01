import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World, WorldSchema } from "../world/world";
import { WorldEngine } from "../../engine/world/worldEngine";

describe("FASE 1 — Criterios de Aceptación del World Engine", () => {
  const createValidWorldData = (): World => ({
    id: "world_01",
    metadata: {
      name: "Fábrica San Rafael",
      description: "Planta de producción industrial",
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
      { id: "area_office", type: "office", name: "Oficina Central", state: {} },
      {
        id: "area_production",
        type: "production_floor",
        name: "Planta de Producción",
        state: {},
      },
      {
        id: "area_warehouse",
        type: "warehouse",
        name: "Depósito Central",
        state: { lighting: "on", inventory: 50 },
      },
    ],
    entities: [
      {
        id: "entity_pallet_01",
        type: "pallet",
        name: "Pallet Madera",
        areaId: "area_warehouse",
        localPosition: { x: 10, y: 5, z: 0 },
        state: { condition: "good" },
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
        id: "role_inst_director",
        roleDefinitionId: "role_def_director",
        name: "Director General",
        areaId: "area_office",
        localPosition: { x: 0, y: 0, z: 0 },
      },
    ],
    state: { globalAlert: false },
  });

  it("1. Creación de World válido", () => {
    const rawData = createValidWorldData();
    const validated = WorldSchema.parse(rawData);
    assert.equal(validated.id, "world_01");
  });

  it("2. Rechazo de World inválido", () => {
    const invalidData = { id: "world_bad", metadata: {} };
    assert.throws(() => WorldSchema.parse(invalidData));
  });

  it("3. Creación de Area", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.areas.length, 3);
    assert.equal(worldData.areas[0].id, "area_office");
  });

  it("4. Creación de Entity", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.entities[0].id, "entity_pallet_01");
    assert.equal(worldData.entities[0].type, "pallet");
  });

  it("5. Creación de RoleInstance", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.roleInstances[0].id, "role_inst_director");
    assert.equal(worldData.roleInstances[0].name, "Director General");
  });

  it("6. Ubicación de RoleInstance dentro de un Area", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.roleInstances[0].areaId, "area_office");
  });

  it("7. Movimiento de RoleInstance entre Areas", () => {
    const engine = new WorldEngine(createValidWorldData());
    engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "role_inst_director",
      targetAreaId: "area_production",
    });
    assert.equal(engine.getWorld().roleInstances[0].areaId, "area_production");
  });

  it("8. Modificación de World State", () => {
    const engine = new WorldEngine(createValidWorldData());
    engine.executeCommand({
      type: "SET_STATE",
      targetType: "AREA",
      targetId: "area_warehouse",
      key: "lighting",
      value: "off",
    });
    assert.equal(
      engine.getWorld().areas.find((a) => a.id === "area_warehouse")?.state
        .lighting,
      "off",
    );
  });

  it("9. Ejecución de Command válido", () => {
    const engine = new WorldEngine(createValidWorldData());
    const event = engine.executeCommand({
      type: "ADD_ENTITY",
      entity: {
        id: "entity_box_01",
        type: "box",
        name: "Caja Cartón",
        areaId: "area_office",
        localPosition: { x: 1, y: 1, z: 0 },
        state: {},
      },
    });
    assert.equal(engine.getWorld().entities.length, 2);
    assert.equal(event.type, "ENTITY_ADDED");
  });

  it("10. Generación de Event", () => {
    const engine = new WorldEngine(createValidWorldData());
    const event = engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "role_inst_director",
      targetAreaId: "area_production",
    });
    assert.equal(event.type, "ROLE_MOVED");
    assert.equal(engine.getEventHistory().length, 1);
  });

  it("11. Serialización de World a JSON", () => {
    const engine = new WorldEngine(createValidWorldData());
    const jsonStr = engine.serialize();
    assert.equal(typeof jsonStr, "string");
    assert.ok(jsonStr.includes("Fábrica San Rafael"));
  });

  it("12. Reconstrucción de World desde JSON", () => {
    const engineOriginal = new WorldEngine(createValidWorldData());
    const jsonStr = engineOriginal.serialize();

    const engineRestored = WorldEngine.deserialize(jsonStr);
    assert.equal(engineRestored.getWorld().id, "world_01");
    assert.equal(engineRestored.getWorld().areas.length, 3);
  });
});
