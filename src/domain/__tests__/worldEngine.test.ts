import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World } from "../../domain/world/world";
import { WorldEngine } from "../../engine/world/worldEngine";
import {
  AreaNotFoundError,
  AreaNotEmptyError,
} from "../../engine/world/errors";
import { WorldEvent } from "../../domain/events/event";

describe("FASE 2 — Batería de Mejora de Testing (Robustez y Edge Cases)", () => {
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
        id: "area_warehouse",
        type: "warehouse",
        name: "Depósito Central",
        state: { lighting: "on", managerNote: null },
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
        capabilities: ["manage"],
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
    state: { globalNote: null },
  });

  it("A. Debe preservar explícitamente previousValue === null", () => {
    const engine = new WorldEngine(createValidWorldData());

    // Cambiar la propiedad 'managerNote' que inicialmente es null
    const event = engine.setAreaState(
      "area_warehouse",
      "managerNote",
      "Revisar inventario",
    );

    assert.equal(event.type, "STATE_CHANGED");
    if (event.type === "STATE_CHANGED") {
      assert.strictEqual(event.previousValue, null);
      assert.equal(event.newValue, "Revisar inventario");
    }
  });

  it("B. Fallo de SET_STATE en un Área inexistente garantiza atomicidad pura", () => {
    const engine = new WorldEngine(createValidWorldData());
    const initialWorldJson = engine.serialize();
    const initialEventCount = engine.getEventHistory().length;

    assert.throws(
      () =>
        engine.executeCommand({
          type: "SET_STATE",
          targetType: "AREA",
          targetId: "area_inexistente",
          key: "lighting",
          value: "off",
        }),
      AreaNotFoundError,
    );

    // ❌ World no cambia
    assert.equal(engine.serialize(), initialWorldJson);
    // ❌ EventLog no cambia
    assert.equal(engine.getEventHistory().length, initialEventCount);
  });

  it("C. Fallo de removeArea garantiza que ni el World ni el EventLog sufren cambios", () => {
    const engine = new WorldEngine(createValidWorldData());
    const initialWorldJson = engine.serialize();
    const initialEventCount = engine.getEventHistory().length;

    // Intento de eliminar area_warehouse que aún contiene el pallet_01
    assert.throws(() => engine.removeArea("area_warehouse"), AreaNotEmptyError);

    // ❌ World no cambia
    assert.equal(engine.serialize(), initialWorldJson);
    // ❌ EventLog no cambia
    assert.equal(engine.getEventHistory().length, initialEventCount);
  });

  it("D. Comando inválido falla mediante CommandSchema y no modifica nada", () => {
    const engine = new WorldEngine(createValidWorldData());
    const initialWorldJson = engine.serialize();
    const initialEventCount = engine.getEventHistory().length;

    assert.throws(() =>
      engine.executeCommand({
        type: "ALGO_QUE_NO_EXISTE",
      }),
    );

    // ❌ World no cambia
    assert.equal(engine.serialize(), initialWorldJson);
    // ❌ EventLog no cambia
    assert.equal(engine.getEventHistory().length, initialEventCount);
  });

  it("E. Inmutabilidad profunda del EventLog (sin casteos as any)", () => {
    const engine = new WorldEngine(createValidWorldData());

    // Generar un evento válido
    engine.setWorldState("globalNote", "Nota Inicial");

    // Obtener la historia de eventos
    const history = engine.getEventHistory();
    assert.equal(history.length, 1);

    // Intentar alterar la propiedad del objeto devuelto en la historia
    const firstEvent = history[0];
    if (firstEvent.type === "STATE_CHANGED") {
      // Intentamos mutar el objeto en la copia devuelta
      (firstEvent as { key: string }).key = "LLAVE_MUTADA";
    }

    // Comprobar que en el motor el historial sigue estando intacto
    const freshHistory = engine.getEventHistory();
    if (freshHistory[0].type === "STATE_CHANGED") {
      assert.equal(freshHistory[0].key, "globalNote");
      assert.notEqual(freshHistory[0].key, "LLAVE_MUTADA");
    }
  });
});
