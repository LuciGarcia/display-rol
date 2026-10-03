import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WorldSchema } from "../../../domain/world/world";
import { LayoutEngine } from "../../../engine/layout/LayoutEngine";
import { PixiWorldRenderer } from "../PixiWorldRenderer";
import { PixiEntityRenderer } from "../PixiEntityRenderer";
import { PixiRoleRenderer } from "../PixiRoleRenderer";

const world = WorldSchema.parse({
  id: "w",
  metadata: { name: "T", createdAt: "x", updatedAt: "x" },
  environment: { id: "e", type: "industrial_factory", name: "F" },
  areas: [
    { id: "a1", type: "office", name: "Oficina" },
    { id: "a2", type: "warehouse", name: "Depósito" },
  ],
  entities: [{ id: "m1", type: "machine", name: "Torno", areaId: "a2" }],
  roleDefinitions: [{ id: "r", name: "Director" }],
  roleInstances: [
    { id: "d", roleDefinitionId: "r", name: "Director", areaId: "a1" },
  ],
});

describe("FASE 4 — Renderer consume LayoutResult", () => {
  const layout = new LayoutEngine().compute(world);

  it("8. entidades y roles se dibujan en las posiciones del layout", () => {
    const slotE = layout.entities.find((s) => s.id === "m1")!;
    const e = PixiEntityRenderer.renderEntity(world.entities[0], slotE);
    assert.equal(e.x, slotE.x);
    assert.equal(e.y, slotE.y);

    const slotR = layout.roles.find((s) => s.id === "d")!;
    const r = PixiRoleRenderer.renderRole(world.roleInstances[0], slotR);
    assert.equal(r.x, slotR.x + slotR.width / 2);
  });

  it("8. render no modifica el World", () => {
    const before = JSON.stringify(world);
    new PixiWorldRenderer().render(world, layout);
    assert.equal(JSON.stringify(world), before);
  });

  it("8. render rechaza un layout que no cubre el World", () => {
    const incompleto = { ...layout, areas: layout.areas.slice(1) };
    assert.throws(
      () => new PixiWorldRenderer().render(world, incompleto),
      /layout no contiene/,
    );
  });

  it("9. PixiWorldRenderer no calcula layout ni tiene mapas hardcodeados", () => {
    const src = readFileSync(
      join(process.cwd(), "src/renderers/pixi/PixiWorldRenderer.ts"),
      "utf8",
    );
    assert.ok(!/areaLayouts|fallbackBounds/.test(src));
    assert.ok(!/LayoutEngine/.test(src));
    assert.ok(/LayoutResult/.test(src));
  });
});
