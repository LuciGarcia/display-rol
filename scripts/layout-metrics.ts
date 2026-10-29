import { WorldSchema, type World } from "../src/domain/world/world";
import type { AreaType } from "../src/domain/world/area";
import { LayoutEngine } from "../src/engine/layout/LayoutEngine";
import { BuildingLayoutEngine } from "../src/engine/layout/BuildingLayoutEngine";
import { validateLayout } from "../src/engine/layout/validateLayout";
import type { LayoutResult } from "../src/engine/layout/types";

const TYPES: AreaType[] = [
  "office",
  "production_floor",
  "warehouse",
  "loading_dock",
  "corridor",
  "reception",
  "laboratory",
  "custom",
];

// Mundos sintéticos: solo tipos semánticos genéricos, nunca ids ni nombres de escenarios.
function makeWorld(
  areaCount: number,
  itemsPerArea: (i: number) => number,
  types = TYPES,
): World {
  const areas = Array.from({ length: areaCount }, (_, i) => ({
    id: `a${i}`,
    type: types[i % types.length],
    name: `Área ${i}`,
  }));
  const entities = areas.flatMap((a, i) =>
    Array.from({ length: itemsPerArea(i) }, (_, k) => ({
      id: `e${i}-${k}`,
      type: "box",
      name: `Caja ${i}-${k}`,
      areaId: a.id,
    })),
  );
  return WorldSchema.parse({
    id: "w",
    metadata: { name: "Caso", createdAt: "x", updatedAt: "x" },
    environment: { id: "e", type: "custom", name: "Caso" },
    areas,
    entities,
    roleDefinitions: [{ id: "r", name: "Rol" }],
    roleInstances: [
      { id: "i0", roleDefinitionId: "r", name: "Rol", areaId: "a0" },
    ],
  });
}

const CASES: Array<[string, World]> = [
  ["A compacto (3 áreas)", makeWorld(3, () => 2)],
  ["B extendido (12 áreas)", makeWorld(12, () => 2)],
  [
    "C ramificado (7, carga desigual)",
    makeWorld(7, (i) => (i % 3 === 0 ? 14 : 1)),
  ],
  ["D restricciones (5, mucha carga)", makeWorld(5, () => 18)],
  ["F instalación (8 tipos)", makeWorld(8, (i) => i + 1)],
  ["G abstracto (6 custom)", makeWorld(6, () => 3, ["custom"])],
  ["H grande (24 áreas)", makeWorld(24, (i) => i % 5)],
];

function stats(layout: LayoutResult) {
  const rects = [...layout.areas, ...(layout.circulation ?? [])];
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.width));
  const y2 = Math.max(...rects.map((r) => r.y + r.height));
  const used = rects.reduce((s, r) => s + r.width * r.height, 0);
  return { fill: used / ((x2 - x1) * (y2 - y1)), w: x2 - x1, h: y2 - y1 };
}

const engines = {
  legacy: new LayoutEngine(),
  building: new BuildingLayoutEngine(),
};
console.log(
  "caso | motor | incidencias duras | áreas | ocupación bbox | tamaño | ms | determinista",
);
for (const [name, world] of CASES) {
  for (const [label, engine] of Object.entries(engines)) {
    const t0 = performance.now();
    const layout = engine.compute(world);
    const ms = performance.now() - t0;
    const issues = validateLayout(layout);
    const deterministic =
      JSON.stringify(layout) === JSON.stringify(engine.compute(world));
    const s = stats(layout);
    console.log(
      `${name} | ${label} | ${issues.length} | ${layout.areas.length} | ${(s.fill * 100).toFixed(0)}% | ${s.w}x${s.h} | ${ms.toFixed(2)} | ${deterministic}`,
    );
  }
}
