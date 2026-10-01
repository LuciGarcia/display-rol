import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World, WorldSchema } from "../../domain/world/world";
import { WorldEngine } from "../../engine/world/worldEngine";
import {
  AreaNotFoundError,
  DuplicateEntityError,
  DuplicateAreaError,
  DuplicateRoleInstanceError,
  RoleDefinitionNotFoundError,
} from "../../engine/world/errors";

describe("FASE 2 — Batería de Pruebas Completa del WorldEngine", () => {
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

  it("1. Agregar y eliminar Areas correctamente", () => {
    const engine = new WorldEngine(createValidWorldData());
    engine.addArea({
      id: "area_dock",
      type: "loading_dock",
      name: "Muelle",
      state: {},
    });
    assert.equal(engine.getWorld().areas.length, 4);

    engine.removeArea("area_dock");
    assert.equal(engine.getWorld().areas.length, 3);
  });

  it("2. Rechazar Area duplicada", () => {
    const engine = new WorldEngine(createValidWorldData());
    assert.throws(
      () =>
        engine.addArea({
          id: "area_office",
          type: "office",
          name: "Oficina Duplicada",
          state: {},
        }),
      DuplicateAreaError,
    );
  });

  it("3. Agregar y eliminar Entities validando invariantes", () => {
    const engine = new WorldEngine(createValidWorldData());
    engine.addEntity({
      id: "entity_box_01",
      type: "box",
      name: "Caja Cartón",
      areaId: "area_office",
      localPosition: { x: 1, y: 1, z: 0 },
      state: {},
    });
    assert.equal(engine.getWorld().entities.length, 2);

    engine.removeEntity("entity_box_01");
    assert.equal(engine.getWorld().entities.length, 1);
  });

  it("4. Rechazar Entity con Area inexistente y Entity duplicada", () => {
    const engine = new WorldEngine(createValidWorldData());
    assert.throws(
      () =>
        engine.addEntity({
          id: "entity_box_bad",
          type: "box",
          name: "Caja Mala",
          areaId: "area_inexistente",
          localPosition: { x: 0, y: 0, z: 0 },
          state: {},
        }),
      AreaNotFoundError,
    );

    assert.throws(
      () =>
        engine.addEntity({
          id: "entity_pallet_01",
          type: "pallet",
          name: "Pallet Duplicado",
          areaId: "area_warehouse",
          localPosition: { x: 0, y: 0, z: 0 },
          state: {},
        }),
      DuplicateEntityError,
    );
  });

  it("5. Agregar y eliminar RoleInstances validando roleDefinitionId e invariantes", () => {
    const engine = new WorldEngine(createValidWorldData());
    engine.addRoleInstance({
      id: "role_inst_jefe",
      roleDefinitionId: "role_def_director",
      name: "Jefe de Mantenimiento",
      areaId: "area_production",
      localPosition: { x: 2, y: 2, z: 0 },
    });
    assert.equal(engine.getWorld().roleInstances.length, 2);

    engine.removeRoleInstance("role_inst_jefe");
    assert.equal(engine.getWorld().roleInstances.length, 1);
  });

  it("6. Rechazar RoleInstance con RoleDefinition inexistente o ID duplicado", () => {
    const engine = new WorldEngine(createValidWorldData());
    assert.throws(
      () =>
        engine.addRoleInstance({
          id: "role_inst_bad",
          roleDefinitionId: "role_def_inexistente",
          name: "Rol Falso",
          areaId: "area_office",
          localPosition: { x: 0, y: 0, z: 0 },
        }),
      RoleDefinitionNotFoundError,
    );

    assert.throws(
      () =>
        engine.addRoleInstance({
          id: "role_inst_director",
          roleDefinitionId: "role_def_director",
          name: "Director Duplicado",
          areaId: "area_office",
          localPosition: { x: 0, y: 0, z: 0 },
        }),
      DuplicateRoleInstanceError,
    );
  });

  it("7. Modificar estados (World, Area, Entity) manteniendo previousValue", () => {
    const engine = new WorldEngine(createValidWorldData());

    const e1 = engine.setAreaState("area_warehouse", "lighting", "off");
    assert.equal(e1.type, "STATE_CHANGED");
    if (e1.type === "STATE_CHANGED") {
      assert.equal(e1.previousValue, "on");
      assert.equal(e1.newValue, "off");
    }

    const e2 = engine.setEntityState(
      "entity_pallet_01",
      "condition",
      "damaged",
    );
    if (e2.type === "STATE_CHANGED") {
      assert.equal(e2.previousValue, "good");
      assert.equal(e2.newValue, "damaged");
    }

    const e3 = engine.setWorldState("globalAlert", true);
    if (e3.type === "STATE_CHANGED") {
      assert.equal(e3.previousValue, false);
      assert.equal(e3.newValue, true);
    }
  });

  it("8. Test de Atomicidad: operación fallida no altera ni el World ni el EventLog", () => {
    const engine = new WorldEngine(createValidWorldData());
    const initialHistoryCount = engine.getEventHistory().length;

    assert.throws(
      () => engine.moveRole("role_inst_director", "area_inexistente"),
      AreaNotFoundError,
    );

    assert.equal(engine.getWorld().roleInstances[0].areaId, "area_office");
    assert.equal(engine.getEventHistory().length, initialHistoryCount);
  });

  it("9. Test de Inmutabilidad Externa en lecturas (getWorld y getEventHistory)", () => {
    const engine = new WorldEngine(createValidWorldData());

    const mutableWorld = engine.getWorld();
    mutableWorld.areas[0].name = "NOMBRE HACKEADO";
    assert.equal(engine.getWorld().areas[0].name, "Oficina Central");

    const mutableEvents = engine.getEventHistory() as any[];
    mutableEvents.push({ type: "EVENTO_FALSO" });
    assert.equal(engine.getEventHistory().length, 0);
  });

  it("10. Serialización y Deserialización impecable", () => {
    const engine = new WorldEngine(createValidWorldData());
    engine.setWorldState("globalAlert", true);

    const serialized = engine.serialize();
    const restoredEngine = WorldEngine.deserialize(serialized);

    assert.equal(restoredEngine.getWorld().id, "world_01");
    assert.equal(restoredEngine.getWorld().state.globalAlert, true);
  });
});
