// src/adapters/__tests__/legacyToWorld.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { legacyToWorld, toAreaType } from "../legacyToWorld";
import { WorldEngine } from "../../engine/world/worldEngine";
import { worldToPanelAreas } from "../worldToPanel";

const map = {
  scenarioName: "Fábrica",
  dimensions: { width: 800, height: 600 },
  obstacles: [],
  areas: [
    {
      id: "a1",
      name: "Oficina",
      type: "oficina",
      currentState: "NORMAL",
      allowedStates: ["NORMAL", "CRISIS"],
      color: "#fff",
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    },
    {
      id: "a2",
      name: "Depósito",
      type: "deposito",
      currentState: "NORMAL",
      allowedStates: ["NORMAL"],
      color: "#fff",
      bounds: { x: 300, y: 0, width: 200, height: 200 },
    },
  ],
};
const chars = [
  {
    id: "c1",
    name: "Director",
    title: "DG",
    x: 50,
    y: 50,
    color: "#f00",
    roleId: "r1",
  },
];
const roles = [
  {
    id: "r1",
    name: "Director",
    title: "DG",
    targetAreaType: "oficina",
    color: "#f00",
  },
];

describe("legacyToWorld", () => {
  it("genera un World válido desde datos legacy", () => {
    const w = legacyToWorld(map, chars, roles);
    assert.equal(w.areas[0].type, "office");
    assert.equal(w.roleInstances[0].areaId, "a1");
  });
  it("mapea tipos desconocidos a custom", () => {
    assert.equal(toAreaType("jardín"), "custom");
  });
  it("SET_STATE y MOVE_ROLE se reflejan en el panel/World", () => {
    const engine = new WorldEngine(legacyToWorld(map, chars, roles));
    engine.executeCommand({
      type: "SET_STATE",
      targetType: "AREA",
      targetId: "a2",
      key: "currentState",
      value: "CRISIS",
    });
    engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "c1",
      targetAreaId: "a2",
    });
    const w = engine.getWorld();
    assert.equal(worldToPanelAreas(w)[1].currentState, "CRISIS");
    assert.equal(w.roleInstances[0].areaId, "a2");
  });
});
