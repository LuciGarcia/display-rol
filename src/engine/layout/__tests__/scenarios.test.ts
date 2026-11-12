import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LAYOUT_SCENARIOS } from "./scenarios";
import { BuildingLayoutEngine } from "../BuildingLayoutEngine";
import { validateLayout } from "../validateLayout";

describe("escenarios de layout (fixtures)", () => {
  const engine = new BuildingLayoutEngine();

  for (const s of LAYOUT_SCENARIOS) {
    it(`"${s.label}": World válido, layout completo y sin incidencias`, () => {
      const world = s.build();
      const layout = engine.compute(world);
      assert.equal(layout.areas.length, world.areas.length);
      assert.deepEqual(validateLayout(layout), []);
    });
  }

  it("cubre las cantidades pedidas (1, 3, 6 y ≥10 áreas), tamaños distintos, relaciones, mucho y nada de contenido", () => {
    const worlds = LAYOUT_SCENARIOS.map((s) => s.build());
    const counts = new Set(worlds.map((w) => w.areas.length));
    for (const n of [1, 3, 6])
      assert.ok(counts.has(n), `falta escenario con ${n} áreas`);
    assert.ok([...counts].some((n) => n >= 10));
    assert.ok(worlds.some((w) => w.areas.some((a) => a.relations.length > 0)));
    assert.ok(worlds.some((w) => w.entities.length >= 60));
    assert.ok(
      worlds.some((w) => w.areas.length > 1 && w.entities.length === 0),
    );
  });

  it("los escenarios no contienen geometría (solo datos semánticos)", () => {
    for (const s of LAYOUT_SCENARIOS) {
      const json = JSON.stringify(s.build().areas);
      assert.ok(!/"(x|y|width|height)"/.test(json));
    }
  });
});
