import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PixiCamera } from "../PixiCamera";
import { WorldEngine } from "../../../engine/world/worldEngine";
import { World } from "../../../domain/world/world";

// Mock del Contenedor para probar la física de la cámara en Node.js puro
class MockContainer {
  public x = 0;
  public y = 0;
  public scale = {
    x: 1,
    y: 1,
    set(value: number) {
      this.x = value;
      this.y = value;
    },
  };
}

describe("FASE 3.3 — Pruebas Unitarias de PixiCamera e Invariantes", () => {
  const createTestWorld = (): World => ({
    id: "world_camera_test",
    metadata: {
      name: "Mundo Test Cámara",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    environment: {
      id: "env_factory",
      type: "industrial_factory",
      name: "Fábrica",
      properties: {},
    },
    areas: [{ id: "office", type: "office", name: "Oficina", state: {} }],
    entities: [],
    roleDefinitions: [
      { id: "role_def_director", name: "Director", capabilities: [] },
    ],
    roleInstances: [
      {
        id: "director",
        roleDefinitionId: "role_def_director",
        name: "Director",
        areaId: "office",
        localPosition: { x: 0, y: 0, z: 0 },
      },
    ],
    state: {},
  });

  it("1. Zoom inicial es 1, respeta límites clamped (minZoom = 0.5, maxZoom = 2.5)", () => {
    const container = new MockContainer() as any;
    const camera = new PixiCamera(container, { minZoom: 0.5, maxZoom: 2.5 });

    assert.equal(camera.getZoom(), 1);

    // Intento de zoom menor al mínimo
    camera.setZoom(0.1);
    assert.equal(camera.getZoom(), 0.5);

    // Intento de zoom mayor al máximo
    camera.setZoom(5.0);
    assert.equal(camera.getZoom(), 2.5);
  });

  it("2. Pan modifica las coordenadas x, y del contenedor y resetPosition las restablece", () => {
    const container = new MockContainer() as any;
    const camera = new PixiCamera(container);

    camera.pan(100, -50);
    assert.equal(container.x, 100);
    assert.equal(container.y, -50);

    camera.resetPosition();
    assert.equal(container.x, 0);
    assert.equal(container.y, 0);
    assert.equal(camera.getZoom(), 1);
  });

  it("3. Invariante: Operar la cámara no modifica el objeto World del dominio", () => {
    const engine = new WorldEngine(createTestWorld());
    const worldJsonBefore = engine.serialize();

    const container = new MockContainer() as any;
    const camera = new PixiCamera(container);

    camera.setZoom(2.0);
    camera.pan(300, 400);

    const worldJsonAfter = engine.serialize();
    assert.equal(worldJsonAfter, worldJsonBefore);
  });
});
