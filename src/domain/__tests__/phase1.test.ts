import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World, WorldSchema } from "../world/world";
import { WorldEngine } from "../../engine/world/worldEngine";

describe("FASE 1 — Fundación Arquitectónica del World Engine", () => {
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

  it("1. Debe permitir la creación de un World válido", () => {
    const rawData = createValidWorldData();
    const validated = WorldSchema.parse(rawData);
    assert.equal(validated.id, "world_01");
  });

  it("2. Debe rechazar un World inválido", () => {
    const invalidData = { id: "world_bad", metadata: {} };
    assert.throws(() => WorldSchema.parse(invalidData));
  });

  it("3. Debe validar la creación de Areas", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.areas.length, 3);
    assert.equal(worldData.areas[0].type, "office");
  });

  it("4. Debe validar la creación de Entities", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.entities[0].name, "Pallet Madera");
    assert.equal(worldData.entities[0].areaId, "area_warehouse");
  });

  it("5. Debe validar la creación de RoleInstance", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.roleInstances[0].name, "Director General");
  });

  it("6. Debe verificar la ubicación de RoleInstance dentro de un Area", () => {
    const worldData = createValidWorldData();
    assert.equal(worldData.roleInstances[0].areaId, "area_office");
  });

  it("7. Debe mover una RoleInstance entre Areas vía Command y emitir Event", () => {
    const engine = new WorldEngine(createValidWorldData());
    const event = engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "role_inst_director",
      targetAreaId: "area_production",
    });

    assert.equal(event.type, "ROLE_MOVED");
    assert.equal(engine.getWorld().roleInstances[0].areaId, "area_production");
  });

  it("8. Debe modificar el World State (Warehouse lighting=off) vía Command y emitir Event", () => {
    const engine = new WorldEngine(createValidWorldData());
    const event = engine.executeCommand({
      type: "SET_STATE",
      targetType: "AREA",
      targetId: "area_warehouse",
      key: "lighting",
      value: "off",
    });

    assert.equal(event.type, "STATE_CHANGED");
    assert.equal(
      engine.getWorld().areas.find((a) => a.id === "area_warehouse")?.state
        .lighting,
      "off",
    );
  });

  it("9. Debe serializar el World a JSON", () => {
    const engine = new WorldEngine(createValidWorldData());
    const jsonStr = engine.serialize();
    assert.equal(typeof jsonStr, "string");
    assert.ok(jsonStr.includes("Fábrica San Rafael"));
  });

  it("10. Debe reconstruir el World desde JSON", () => {
    const engineOriginal = new WorldEngine(createValidWorldData());
    const jsonStr = engineOriginal.serialize();

    const engineRestored = WorldEngine.deserialize(jsonStr);
    assert.equal(engineRestored.getWorld().id, "world_01");
    assert.equal(engineRestored.getWorld().areas.length, 3);
  });
});
