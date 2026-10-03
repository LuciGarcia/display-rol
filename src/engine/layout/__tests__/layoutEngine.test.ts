import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LayoutEngine } from "../LayoutEngine";
import { WorldSchema } from "../../../domain/world/world";

const makeWorld = (entityCount: number) =>
  WorldSchema.parse({
    id: "w",
    metadata: { name: "T", createdAt: "x", updatedAt: "x" },
    environment: { id: "e", type: "industrial_factory", name: "F" },
    areas: [
      { id: "a1", type: "office", name: "Oficina" },
      { id: "a2", type: "production_floor", name: "Planta" },
      { id: "a3", type: "warehouse", name: "Depósito" },
    ],
    entities: Array.from({ length: entityCount }, (_, i) => ({
      id: `m${i}`,
      type: "machine",
      name: `M${i}`,
      areaId: "a2",
    })),
    roleDefinitions: [{ id: "r", name: "Director" }],
    roleInstances: [
      { id: "d", roleDefinitionId: "r", name: "Director", areaId: "a1" },
    ],
  });

const inside = (
  a: { x: number; y: number; width: number; height: number },
  s: { x: number; y: number; width: number; height: number },
) =>
  s.x >= a.x &&
  s.y >= a.y &&
  s.x + s.width <= a.x + a.width &&
  s.y + s.height <= a.y + a.height;

describe("LayoutEngine", () => {
  const engine = new LayoutEngine();

  it("es determinista", () => {
    const w = makeWorld(7);
    assert.deepEqual(engine.compute(w), engine.compute(w));
  });
  it("no modifica el World", () => {
    const w = makeWorld(7);
    const before = JSON.stringify(w);
    engine.compute(w);
    assert.equal(JSON.stringify(w), before);
  });
  it("todas las áreas tienen layout", () =>
    assert.equal(
      engine.compute(makeWorld(0)).areas.length,
      makeWorld(0).areas.length,
    ));
  it("área inexistente lanza error", () =>
    assert.throws(() =>
      engine.compute(
        WorldSchema.parse({
          ...makeWorld(0),
          entities: [
            { id: "m", type: "machine", name: "M", areaId: "invalid" },
          ],
        }),
      ),
    ));
  it("entidades y roles quedan dentro de su área, aun con muchas entidades", () => {
    const w = makeWorld(25);
    const l = engine.compute(w);
    const area = (id: string) => l.areas.find((a) => a.id === id)!;
    for (const s of [...l.entities, ...l.roles])
      assert.ok(inside(area(s.areaId), s));
  });
  it("las áreas no se solapan", () => {
    const l = engine.compute(makeWorld(25));
    for (let i = 0; i < l.areas.length; i++)
      for (let j = i + 1; j < l.areas.length; j++) {
        const a = l.areas[i],
          b = l.areas[j];
        const overlap =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        assert.equal(overlap, false);
      }
  });
  it("World vacío devuelve layout vacío", () => {
    const w = WorldSchema.parse({
      ...makeWorld(0),
      areas: [],
      entities: [],
      roleInstances: [],
    });
    assert.deepEqual(engine.compute(w), { areas: [], entities: [], roles: [] });
  });
});
