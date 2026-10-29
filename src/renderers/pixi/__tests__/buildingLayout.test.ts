import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorldSchema, type World } from "../../../domain/world/world";
import { AreaTypeSchema } from "../../../domain/world/area";
import { BuildingLayoutEngine } from "@/engine/layout/BuildingLayoutEngine";
import { validateLayout } from "@/engine/layout/validateLayout";
import {
  GRID,
  FIRST_ROOM,
  OccupancyGrid,
  boundaries,
} from "@/engine/layout/geometry";

const TYPES = AreaTypeSchema.options;

// Mundos abstractos: solo tipos semánticos, nunca ids ni nombres de escenarios.
const makeWorld = (
  areaCount: number,
  itemsPerArea: (i: number) => number = () => 2,
): World =>
  WorldSchema.parse({
    id: "w",
    metadata: { name: "T", createdAt: "x", updatedAt: "x" },
    environment: { id: "e", type: "custom", name: "E" },
    areas: Array.from({ length: areaCount }, (_, i) => ({
      id: `a${i}`,
      type: TYPES[i % TYPES.length],
      name: `Área ${i}`,
    })),
    entities: Array.from({ length: areaCount }, (_, i) =>
      Array.from({ length: itemsPerArea(i) }, (_, k) => ({
        id: `e${i}-${k}`,
        type: "box",
        name: "Caja",
        areaId: `a${i}`,
      })),
    ).flat(),
    roleDefinitions: [{ id: "r", name: "Rol" }],
    roleInstances:
      areaCount > 0
        ? [{ id: "i0", roleDefinitionId: "r", name: "Rol", areaId: "a0" }]
        : [],
  });

describe("BuildingLayoutEngine", () => {
  const engine = new BuildingLayoutEngine();

  it("es determinista y no modifica el World", () => {
    const w = makeWorld(9, (i) => i);
    const before = JSON.stringify(w);
    assert.deepEqual(engine.compute(w), engine.compute(w));
    assert.equal(JSON.stringify(w), before);
  });

  it("mundo vacío → layout vacío", () => {
    const l = engine.compute(makeWorld(0));
    assert.equal(l.areas.length, 0);
    assert.deepEqual(validateLayout(l), []);
  });

  it("área inexistente lanza error", () => {
    const w = makeWorld(2);
    w.entities.push({
      id: "x",
      type: "box",
      name: "X",
      areaId: "nope",
      localPosition: { x: 0, y: 0, z: 0 },
      state: {},
    });
    assert.throws(() => engine.compute(w), /área inexistente/);
  });

  for (const count of [1, 2, 3, 5, 8, 12, 24]) {
    it(`${count} áreas: sin incidencias duras (solape, accesos, transitabilidad)`, () => {
      const l = engine.compute(makeWorld(count, (i) => (i % 4) * 5));
      assert.equal(l.areas.length, count);
      assert.deepEqual(validateLayout(l), []);
    });
  }

  it("muchas entidades: crece el alto y los slots quedan dentro", () => {
    const l = engine.compute(makeWorld(4, () => 30));
    assert.deepEqual(validateLayout(l), []);
  });

  it("todo está alineado a la grilla", () => {
    const l = engine.compute(makeWorld(11, (i) => i));
    for (const r of [...l.areas, ...(l.circulation ?? [])])
      for (const v of [r.x, r.y, r.width, r.height])
        assert.equal(v % GRID, 0, `${r.id}: ${v}`);
  });

  it("cada área tiene exactamente un hueco y está en un muro, no sobre uno continuo", () => {
    const l = engine.compute(makeWorld(8));
    assert.equal(l.openings!.length, l.areas.length);
    // ningún segmento de muro atraviesa un hueco
    for (const o of l.openings!) {
      for (const w of l.walls!) {
        if (o.orientation === "h" && w.y1 === w.y2 && w.y1 === o.y)
          assert.ok(w.x2 <= o.x || w.x1 >= o.x + o.length, o.id);
        if (o.orientation === "v" && w.x1 === w.x2 && w.x1 === o.x)
          assert.ok(w.y2 <= o.y || w.y1 >= o.y + o.length, o.id);
      }
    }
  });

  it("los muros cierran el perímetro: cada borde entre dueños distintos es muro o hueco", () => {
    const l = engine.compute(makeWorld(6));
    const maxX = Math.max(
      ...[...l.areas, ...l.circulation!].map((r) => r.x + r.width),
    );
    const maxY = Math.max(
      ...[...l.areas, ...l.circulation!].map((r) => r.y + r.height),
    );
    const grid = new OccupancyGrid(maxX + GRID, maxY + GRID);
    l.circulation!.forEach((c) => grid.paint(c, 1));
    l.areas.forEach((a, i) => grid.paint(a, FIRST_ROOM + i));
    const doorUnits = l.openings!.reduce((s, o) => s + o.length / GRID, 0);
    const wallUnits = l.walls!.reduce(
      (s, w) => s + (Math.abs(w.x2 - w.x1) + Math.abs(w.y2 - w.y1)) / GRID,
      0,
    );
    assert.equal(wallUnits + doorUnits, boundaries(grid).length);
  });

  it("no depende de ids ni nombres", () => {
    const a = makeWorld(6);
    const b = WorldSchema.parse({
      ...a,
      areas: a.areas.map((x, i) => ({
        ...x,
        id: `zz-${i}`,
        name: `Otro ${i}`,
      })),
      entities: a.entities.map((e) => ({
        ...e,
        areaId: e.areaId.replace("a", "zz-"),
      })),
      roleInstances: a.roleInstances.map((r) => ({
        ...r,
        areaId: r.areaId.replace("a", "zz-"),
      })),
    });
    const strip = (l: ReturnType<BuildingLayoutEngine["compute"]>) =>
      l.areas.map(({ x, y, width, height }) => [x, y, width, height]);
    assert.deepEqual(strip(engine.compute(a)), strip(engine.compute(b)));
  });

  it("el validador detecta un hueco que no atraviesa un muro y un solapamiento", () => {
    const l = engine.compute(makeWorld(4));
    const broken = structuredClone(l);
    broken.openings![0] = { ...broken.openings![0], x: 5000, y: 5000 };
    assert.ok(validateLayout(broken).some((i) => i.code === "opening-invalid"));
    const overlapped = structuredClone(l);
    overlapped.areas[1] = {
      ...overlapped.areas[1],
      x: overlapped.areas[0].x,
      y: overlapped.areas[0].y,
    };
    assert.ok(validateLayout(overlapped).some((i) => i.code === "overlap"));
  });

  it("el validador detecta un área sin acceso (muro continuo)", () => {
    const l = engine.compute(makeWorld(4));
    const walled = structuredClone(l);
    walled.openings = walled.openings!.slice(1);
    const codes = validateLayout(walled).map((i) => i.code);
    assert.ok(codes.includes("no-opening"));
    assert.ok(codes.includes("unreachable"));
  });
});
