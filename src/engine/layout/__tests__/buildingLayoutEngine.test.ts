import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BuildingLayoutEngine } from "../BuildingLayoutEngine";
import { orderByRelations } from "../relationOrder";
import { validateLayout } from "../validateLayout";
import { WorldSchema, type World } from "../../../domain/world/world";
import type { AreaType } from "../../../domain/world/area";
import type { LayoutResult, Rect } from "../types";

interface AreaSpec {
  id: string;
  type?: AreaType;
  entities?: number;
  roles?: number;
  relations?: {
    targetAreaId: string;
    type: "adjacency" | "proximity" | "access";
    strength: "preferred" | "required";
  }[];
}

const TYPES: AreaType[] = [
  "office",
  "production_floor",
  "warehouse",
  "loading_dock",
  "reception",
  "laboratory",
  "custom",
];

function makeWorld(specs: AreaSpec[]): World {
  return WorldSchema.parse({
    id: "w",
    metadata: { name: "T", createdAt: "x", updatedAt: "x" },
    environment: { id: "e", type: "custom", name: "E" },
    areas: specs.map((s, i) => ({
      id: s.id,
      type: s.type ?? TYPES[i % TYPES.length],
      name: s.id,
      relations: s.relations,
    })),
    entities: specs.flatMap((s) =>
      Array.from({ length: s.entities ?? 0 }, (_, k) => ({
        id: `${s.id}-e${k}`,
        type: "machine",
        name: "m",
        areaId: s.id,
      })),
    ),
    roleDefinitions: [{ id: "r", name: "R" }],
    roleInstances: specs.flatMap((s) =>
      Array.from({ length: s.roles ?? 0 }, (_, k) => ({
        id: `${s.id}-r${k}`,
        roleDefinitionId: "r",
        name: "r",
        areaId: s.id,
      })),
    ),
  });
}

const many = (n: number, extra: Partial<AreaSpec> = {}): AreaSpec[] =>
  Array.from({ length: n }, (_, i) => ({ id: `a${i + 1}`, ...extra }));

const engine = new BuildingLayoutEngine();
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;
const inside = (a: Rect, s: Rect) =>
  s.x >= a.x &&
  s.y >= a.y &&
  s.x + s.width <= a.x + a.width &&
  s.y + s.height <= a.y + a.height;

// Todo layout generado debe cumplir las reglas duras, estén o no relacionadas las áreas.
function assertValid(
  world: World,
  layout: LayoutResult = engine.compute(world),
): LayoutResult {
  assert.deepEqual(
    validateLayout(layout),
    [],
    "validateLayout debe devolver 0 incidencias",
  );
  assert.equal(
    layout.areas.length,
    world.areas.length,
    "no se pierde ninguna habitación",
  );
  assert.deepEqual(
    layout.areas.map((a) => a.id).sort(),
    world.areas.map((a) => a.id).sort(),
  );
  layout.areas.forEach((a, i) => {
    layout.areas
      .slice(i + 1)
      .forEach((b) => assert.ok(!overlap(a, b), `${a.id} solapa ${b.id}`));
    (layout.circulation ?? []).forEach((c) =>
      assert.ok(!overlap(a, c), `${a.id} solapa ${c.id}`),
    );
  });
  for (const slot of [...layout.entities, ...layout.roles]) {
    const area = layout.areas.find((a) => a.id === slot.areaId)!;
    assert.ok(inside(area, slot), `${slot.id} fuera de ${area.id}`);
  }
  return layout;
}

describe("BuildingLayoutEngine — casos básicos", () => {
  it("mundo sin áreas: resultado vacío sin errores", () => {
    const layout = engine.compute(makeWorld([]));
    assert.deepEqual(layout.areas, []);
    assert.deepEqual(layout.walls, []);
    assert.deepEqual(validateLayout(layout), []);
  });

  for (const n of [1, 2, 3, 4, 5, 6, 7, 10, 15, 25]) {
    it(`${n} área(s) (${n % 2 ? "impar" : "par"}): válido y completo`, () => {
      assertValid(makeWorld(many(n, { entities: 2, roles: 1 })));
    });
  }

  it("una sola habitación sigue teniendo muros, pero no exige circulación", () => {
    const layout = assertValid(makeWorld(many(1)));
    assert.ok((layout.walls?.length ?? 0) > 0);
  });
});

describe("BuildingLayoutEngine — variedad de distribución", () => {
  it("tamaños muy distintos (tipos y contenido)", () => {
    const specs: AreaSpec[] = [
      { id: "peq", type: "office", entities: 0 },
      { id: "gran", type: "production_floor", entities: 40, roles: 5 },
      { id: "med", type: "warehouse", entities: 6 },
      { id: "dock", type: "loading_dock" },
      { id: "vacia", type: "custom" },
      { id: "lab", type: "laboratory", entities: 12 },
    ];
    assertValid(makeWorld(specs));
  });

  it("un área con muchísimas entidades crece para contenerlas", () => {
    const world = makeWorld([
      { id: "a", type: "office", entities: 80 },
      { id: "b" },
    ]);
    const layout = assertValid(world);
    const a = layout.areas.find((x) => x.id === "a")!;
    const empty = engine
      .compute(makeWorld([{ id: "a", type: "office" }, { id: "b" }]))
      .areas.find((x) => x.id === "a")!;
    assert.ok(a.height > empty.height, "crece en alto para alojar 80 slots");
  });

  it("áreas sin entidades ni roles", () => {
    const layout = assertValid(makeWorld(many(6)));
    assert.equal(layout.entities.length + layout.roles.length, 0);
  });

  it("muchas habitaciones generan varias filas y circulación", () => {
    const layout = assertValid(makeWorld(many(12, { entities: 3 })));
    const rows = new Set(layout.areas.map((a) => a.y));
    assert.ok(rows.size >= 2, "debe haber varias filas");
    assert.ok((layout.circulation?.length ?? 0) >= 1);
  });

  it("pocas habitaciones: sin pasillos laterales innecesarios", () => {
    const layout = assertValid(makeWorld(many(2)));
    assert.ok(
      (layout.circulation ?? []).every((c) => c.id !== "circulation-spine"),
    );
  });

  it("cada habitación (con más de una) tiene una puerta hacia la circulación", () => {
    const layout = assertValid(makeWorld(many(9, { entities: 2 })));
    for (const a of layout.areas) {
      assert.ok(
        layout.openings!.some((o) => o.areaId === a.id),
        `${a.id} sin puerta`,
      );
    }
  });

  it("las puertas tienen el ancho configurado y caen sobre un muro lindante con circulación", () => {
    const layout = assertValid(makeWorld(many(6)));
    for (const o of layout.openings!) {
      assert.ok(o.length >= 20);
      const area = layout.areas.find((a) => a.id === o.areaId)!;
      const onEdge =
        o.orientation === "h"
          ? (o.y === area.y || o.y === area.y + area.height) &&
            o.x >= area.x &&
            o.x + o.length <= area.x + area.width
          : (o.x === area.x || o.x === area.x + area.width) &&
            o.y >= area.y &&
            o.y + o.length <= area.y + area.height;
      assert.ok(onEdge, `puerta ${o.id} fuera del borde de ${area.id}`);
    }
  });

  it("los pasillos respetan el ancho mínimo y las opciones personalizadas", () => {
    const wide = new BuildingLayoutEngine({
      corridorWidth: 80,
      maxRowWidth: 700,
    });
    const world = makeWorld(many(10, { entities: 2 }));
    const layout = wide.compute(world);
    assert.deepEqual(validateLayout(layout), []);
    assert.ok(
      (layout.circulation ?? []).every(
        (c) => Math.min(c.width, c.height) >= 80,
      ),
    );
  });
});

describe("BuildingLayoutEngine — determinismo, orden de entrada e inmutabilidad", () => {
  const specs = [...many(8, { entities: 2 })];

  it("misma entrada, mismo resultado", () => {
    const world = makeWorld(specs);
    assert.deepEqual(engine.compute(world), engine.compute(world));
    assert.deepEqual(
      new BuildingLayoutEngine().compute(world),
      engine.compute(world),
    );
  });

  it("no modifica el World recibido", () => {
    const world = makeWorld([
      ...many(5, { entities: 2 }).map((s, i) => ({
        ...s,
        relations: i
          ? [
              {
                targetAreaId: "a1",
                type: "access" as const,
                strength: "required" as const,
              },
            ]
          : [],
      })),
    ]);
    const before = JSON.stringify(world);
    engine.compute(world);
    assert.equal(JSON.stringify(world), before);
  });

  it("DOCUMENTADO: sin relaciones el orden de entrada SÍ determina la posición; el resultado es siempre válido", () => {
    const forward = makeWorld(specs);
    const reversed = makeWorld([...specs].reverse());
    const a = assertValid(forward);
    const b = assertValid(reversed);
    const pos = (l: LayoutResult, id: string) => {
      const r = l.areas.find((x) => x.id === id)!;
      return `${r.x},${r.y}`;
    };
    // Aceptable: el orden de áreas del World es el criterio de desempate estable. Se mide, no se oculta.
    assert.notEqual(pos(a, "a1"), pos(b, "a1"));
    assert.deepEqual(
      a.areas.map((x) => x.id).sort(),
      b.areas.map((x) => x.id).sort(),
    );
  });

  it("el orden de la salida coincide con el de world.areas (consumidores por índice)", () => {
    const world = makeWorld(specs);
    assert.deepEqual(
      engine.compute(world).areas.map((a) => a.id),
      world.areas.map((a) => a.id),
    );
  });
});

const rel = (
  targetAreaId: string,
  type: "adjacency" | "proximity" | "access" = "adjacency",
  strength: "preferred" | "required" = "preferred",
) => ({ targetAreaId, type, strength });

// distancia entre centros de dos habitaciones
const dist = (l: LayoutResult, p: string, q: string) => {
  const a = l.areas.find((x) => x.id === p)!;
  const b = l.areas.find((x) => x.id === q)!;
  return Math.hypot(
    a.x + a.width / 2 - (b.x + b.width / 2),
    a.y + a.height / 2 - (b.y + b.height / 2),
  );
};

describe("BuildingLayoutEngine — relaciones como criterio de orden", () => {
  it("mundo sin relaciones: igual que antes (orden identidad)", () => {
    assert.deepEqual(
      orderByRelations(makeWorld(many(6)).areas),
      [0, 1, 2, 3, 4, 5],
    );
  });

  for (const type of ["adjacency", "proximity", "access"] as const) {
    it(`relación ${type}: acerca las áreas relacionadas sin exigir nada físico`, () => {
      const specs = many(8, { entities: 1 });
      specs[0].relations = [rel("a8", type)];
      const world = makeWorld(specs);
      const layout = assertValid(world);
      const baseline = assertValid(makeWorld(many(8, { entities: 1 })));
      assert.ok(dist(layout, "a1", "a8") < dist(baseline, "a1", "a8"));
    });
  }

  it("relaciones entre áreas no consecutivas en el array: quedan consecutivas en el orden", () => {
    const specs = many(6);
    specs[0].relations = [rel("a5")];
    const order = orderByRelations(makeWorld(specs).areas);
    const p = (i: number) => order.indexOf(i);
    assert.equal(Math.abs(p(0) - p(4)), 1);
  });

  it("required tiene prioridad sobre preferred", () => {
    const specs = many(5);
    specs[0].relations = [
      rel("a3", "adjacency", "preferred"),
      rel("a5", "access", "required"),
    ];
    const order = orderByRelations(makeWorld(specs).areas);
    // la semilla (a1) coloca primero a a5 (required) y luego a a3
    assert.deepEqual(order.slice(0, 3), [0, 4, 2]);
  });

  it("varias relaciones sobre una misma área: nadie se pierde y el resultado es válido", () => {
    const specs = many(7, { entities: 1 });
    specs[2].relations = [
      rel("a1"),
      rel("a5", "proximity"),
      rel("a7", "access", "required"),
    ];
    const world = makeWorld(specs);
    const order = orderByRelations(world.areas);
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      [0, 1, 2, 3, 4, 5, 6],
    );
    assertValid(world);
  });

  it("relaciones preferred y required mezcladas no hacen fallar ni descartar nada", () => {
    const specs = many(10, { entities: 2 });
    specs.forEach((s, i) => {
      s.relations = [
        rel(
          `a${((i + 3) % 10) + 1}`,
          "proximity",
          i % 2 ? "required" : "preferred",
        ),
      ];
    });
    assertValid(makeWorld(specs));
  });

  it("DETERMINISTA con relaciones y con el mismo orden de entrada", () => {
    const specs = many(9, { entities: 1 });
    specs[1].relations = [rel("a9"), rel("a4", "access", "required")];
    const world = makeWorld(specs);
    assert.deepEqual(engine.compute(world), engine.compute(world));
  });

  it("una relación required NO es un contrato geométrico: el motor no falla ni la declara cumplida", () => {
    // 'a1' exige acceso a 'a12' pero hay 12 áreas y varias filas: puede quedar sin satisfacer.
    const specs = many(12);
    specs[0].relations = [rel("a12", "adjacency", "required")];
    const world = makeWorld(specs);
    const layout = engine.compute(world); // no lanza
    assert.deepEqual(validateLayout(layout), []); // sin errores geométricos
    // la relación sigue intacta en el dominio para evaluarla en la etapa 1
    assert.deepEqual(world.areas[0].relations, [
      rel("a12", "adjacency", "required"),
    ]);
    // y el layout no inventa ninguna puerta/pasillo por la relación
    const baseline = engine.compute(makeWorld(many(12)));
    assert.equal(layout.openings!.length, baseline.openings!.length);
    assert.equal(layout.circulation!.length, baseline.circulation!.length);
  });

  it("las relaciones no cambian el número de puertas, pasillos ni habitaciones", () => {
    const specs = many(8, { entities: 1 });
    specs[0].relations = [rel("a7", "access", "required")];
    const withRel = engine.compute(makeWorld(specs));
    const without = engine.compute(makeWorld(many(8, { entities: 1 })));
    assert.equal(withRel.areas.length, without.areas.length);
    assert.equal(withRel.openings!.length, without.openings!.length);
    assert.equal(withRel.circulation!.length, without.circulation!.length);
  });

  it("referencias a áreas inexistentes (World mal formado) se ignoran en el layout", () => {
    const world = makeWorld(many(4));
    // se evita el schema a propósito: el motor no debe romperse aunque reciba datos inconsistentes
    (world.areas[0] as { relations: unknown[] }).relations = [
      rel("fantasma"),
      rel("a1"),
    ];
    assert.deepEqual(orderByRelations(world.areas), [0, 1, 2, 3]);
    assertValid(world);
  });

  it("DOCUMENTADO: con relaciones, permutar la entrada puede cambiar la distribución pero siempre es válida", () => {
    const specs = many(8);
    specs[0].relations = [rel("a8")];
    const a = assertValid(makeWorld(specs));
    const b = assertValid(makeWorld([...specs].reverse()));
    // en ambos casos a1 y a8 quedan consecutivos en el orden de procesamiento
    for (const l of [a, b]) {
      const order = orderByRelations(
        l === a
          ? makeWorld(specs).areas
          : makeWorld([...specs].reverse()).areas,
      );
      const ids = (l === a ? specs : [...specs].reverse()).map((s) => s.id);
      assert.equal(
        Math.abs(
          order.indexOf(ids.indexOf("a1")) - order.indexOf(ids.indexOf("a8")),
        ),
        1,
      );
    }
  });
});

describe("BuildingLayoutEngine — geometría y circulación", () => {
  it("las habitaciones no quedan aisladas: todas alcanzables (validateLayout: reachability)", () => {
    for (const n of [2, 3, 5, 8, 13, 20]) {
      const layout = engine.compute(makeWorld(many(n, { entities: 1 })));
      assert.ok(
        !validateLayout(layout).some((i) => i.code === "unreachable"),
        `n=${n}`,
      );
      assert.ok(
        !validateLayout(layout).some((i) => i.code === "no-opening"),
        `n=${n}`,
      );
    }
  });

  it("los muros no cruzan una puerta: cada apertura queda libre de segmentos de muro", () => {
    const layout = assertValid(makeWorld(many(8, { entities: 1 })));
    for (const o of layout.openings!) {
      for (const w of layout.walls!) {
        const horizontal = w.y1 === w.y2;
        if (o.orientation === "h" && horizontal && w.y1 === o.y) {
          const lo = Math.min(w.x1, w.x2);
          const hi = Math.max(w.x1, w.x2);
          assert.ok(
            hi <= o.x || lo >= o.x + o.length,
            `muro cubre la puerta ${o.id}`,
          );
        }
        if (o.orientation === "v" && !horizontal && w.x1 === o.x) {
          const lo = Math.min(w.y1, w.y2);
          const hi = Math.max(w.y1, w.y2);
          assert.ok(
            hi <= o.y || lo >= o.y + o.length,
            `muro cubre la puerta ${o.id}`,
          );
        }
      }
    }
  });

  it("los muros son segmentos alineados a los ejes con longitud positiva", () => {
    const layout = engine.compute(makeWorld(many(7)));
    for (const w of layout.walls!) {
      assert.ok(w.x1 === w.x2 || w.y1 === w.y2);
      assert.ok(Math.abs(w.x2 - w.x1) + Math.abs(w.y2 - w.y1) > 0);
    }
  });

  it("validateLayout detecta un solapamiento introducido a mano (el validador funciona)", () => {
    const layout = engine.compute(makeWorld(many(3)));
    const broken: LayoutResult = {
      ...layout,
      areas: layout.areas.map((a, i) =>
        i === 1 ? { ...layout.areas[0], id: a.id } : a,
      ),
    };
    assert.ok(validateLayout(broken).some((i) => i.code === "overlap"));
  });

  it("validateLayout detecta una abertura inválida y una habitación sin puerta", () => {
    const layout = engine.compute(makeWorld(many(4)));
    const noDoors: LayoutResult = { ...layout, openings: [] };
    assert.ok(validateLayout(noDoors).some((i) => i.code === "no-opening"));
    const bad: LayoutResult = {
      ...layout,
      openings: layout.openings!.map((o, i) =>
        i === 0 ? { ...o, x: o.x + 5000 } : o,
      ),
    };
    assert.ok(validateLayout(bad).length > 0);
  });
});
