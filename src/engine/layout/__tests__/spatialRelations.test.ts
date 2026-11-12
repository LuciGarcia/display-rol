import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BuildingLayoutEngine } from "../BuildingLayoutEngine";
import {
  layoutVerdict,
  validateLayout,
  type LayoutIssue,
} from "../validateLayout";
import {
  evaluateRelations,
  findImpossibleRelations,
} from "../relationEvaluation";
import {
  buildSpatialGraph,
  circulationComponents,
  routeBetween,
} from "../spatialGraph";
import {
  edgeDistance,
  junctionWidth,
  proximityRange,
  sharedBorder,
} from "../spatialCriteria";
import {
  CIRCULATION,
  FIRST_ROOM,
  GRID,
  OccupancyGrid,
  buildWalls,
} from "../geometry";
import { analyzeRelations } from "../../spatial/relationAnalysis";
import { WorldSchema, type World } from "../../../domain/world/world";
import { LAYOUT_SCENARIOS } from "./scenarios";
import type { LayoutResult } from "../types";

type Rel = {
  targetAreaId: string;
  type: "adjacency" | "proximity" | "access";
  strength: "preferred" | "required";
};
const rel = (
  t: string,
  type: Rel["type"] = "adjacency",
  strength: Rel["strength"] = "required",
): Rel => ({ targetAreaId: t, type, strength });
const areas = (spec: Record<string, Rel[]>) =>
  Object.entries(spec).map(([id, relations]) => ({ id, relations }));

// Layout a mano: A y B comparten muro (x=240); C queda al otro lado del pasillo.
//  A(40,40,200x200) B(240,40,200x200)  pasillo y=240..300  C(40,300,200x200)
const door = (id: string, areaId: string, x: number, y: number) => ({
  id,
  areaId,
  orientation: "h" as const,
  x,
  y,
  length: 40,
});
const handLayout = (): LayoutResult => ({
  areas: [
    { id: "A", x: 40, y: 40, width: 200, height: 200 },
    { id: "B", x: 240, y: 40, width: 200, height: 200 },
    { id: "C", x: 40, y: 300, width: 200, height: 200 },
  ],
  entities: [],
  roles: [],
  circulation: [{ id: "p0", x: 40, y: 240, width: 400, height: 60 }],
  openings: [
    door("dA", "A", 100, 240),
    door("dB", "B", 300, 240),
    door("dC", "C", 100, 300),
  ],
});
const codes = (l: LayoutResult, spec: Record<string, Rel[]>) =>
  validateLayout(l, { analysis: analyzeRelations(areas(spec)) }).map(
    (i) => i.code,
  );

describe("Fase 2 — criterios geométricos", () => {
  it("adyacencia = borde compartido ≥ mínimo; esquina o pasillo de por medio no cuentan", () => {
    const [A, B, C] = handLayout().areas;
    assert.equal(sharedBorder(A, B), 200);
    assert.equal(sharedBorder(A, C), 0); // separadas por el pasillo
    assert.equal(sharedBorder(A, { x: 240, y: 240, width: 50, height: 50 }), 0); // esquina
  });
  it("proximidad: distancia entre bordes, con rango que crece con el tamaño", () => {
    const [A, , C] = handLayout().areas;
    assert.equal(edgeDistance(A, C), 60);
    const small = { x: 0, y: 0, width: 50, height: 50 };
    const big = { x: 0, y: 0, width: 500, height: 500 };
    assert.ok(proximityRange(big, big) > proximityRange(small, small));
  });
});

describe("Fase 2 — evaluación de relaciones sobre geometría real", () => {
  it("adyacencia required cumplida con evidencia; incumplida con diagnóstico", () => {
    const ok = validateLayout(handLayout(), {
      analysis: analyzeRelations(areas({ A: [rel("B")], B: [], C: [] })),
    });
    assert.deepEqual(
      ok.filter((i) => i.severity === "error"),
      [],
    );
    const g = buildSpatialGraph(handLayout());
    const [e] = evaluateRelations(
      g,
      analyzeRelations(areas({ A: [rel("B")], B: [] })).relations,
    );
    assert.equal(e.status, "satisfied");
    assert.equal(e.evidence.sharedBorder, 200);

    const bad = validateLayout(handLayout(), {
      analysis: analyzeRelations(areas({ A: [rel("C")], B: [], C: [] })),
    });
    const issue = bad.find((i) => i.code === "required-adjacency-unmet")!;
    assert.equal(issue.severity, "error");
    assert.equal(issue.category, "semantic");
    assert.deepEqual(issue.areaIds, ["A", "C"]);
    assert.equal(issue.relationId, "adjacency:A~C");
    assert.equal(layoutVerdict(bad), "invalid");
  });

  it("proximidad required cumplida y incumplida", () => {
    assert.ok(
      !codes(handLayout(), {
        A: [rel("C", "proximity")],
        B: [],
        C: [],
      }).includes("required-proximity-unmet"),
    );
    const far = handLayout();
    far.areas[2] = { id: "C", x: 40, y: 900, width: 200, height: 200 };
    far.circulation![0] = { id: "p0", x: 40, y: 240, width: 400, height: 60 };
    assert.ok(
      codes(far, { A: [rel("C", "proximity")], B: [], C: [] }).includes(
        "required-proximity-unmet",
      ),
    );
  });

  it("acceso: válido por ruta puerta→pasillo→puerta; inválido si la puerta no atraviesa un muro", () => {
    const spec = { A: [rel("C", "access")], B: [], C: [] };
    const g = buildSpatialGraph(handLayout());
    assert.deepEqual(routeBetween(g, "room:A", "room:C")?.spaces, [
      "room:A",
      "corridor:p0",
      "room:C",
    ]);
    assert.ok(!codes(handLayout(), spec).includes("required-access-unmet"));

    const broken = handLayout();
    broken.openings![2] = door("dC", "C", 100, 400); // dentro de C: no conecta nada
    const c = codes(broken, spec);
    assert.ok(c.includes("opening-invalid"));
    assert.ok(c.includes("required-access-unmet"));
  });

  it("acceso por puerta DIRECTA entre habitaciones con muro común", () => {
    const l = handLayout();
    l.openings!.push({
      id: "dAB",
      areaId: "A",
      orientation: "v",
      x: 240,
      y: 100,
      length: 40,
    });
    const g = buildSpatialGraph(l);
    assert.deepEqual(routeBetween(g, "room:A", "room:B")?.doors, ["dAB"]);
  });

  it("las habitaciones no son tránsito: sin pasillo conectado no hay acceso aunque ambas tengan puerta a 'algún' pasillo", () => {
    const l = handLayout();
    l.circulation!.push({ id: "p1", x: 40, y: 500, width: 400, height: 60 }); // otro pasillo, aislado
    l.areas[2] = { id: "C", x: 40, y: 560, width: 200, height: 200 };
    l.openings![2] = door("dC", "C", 100, 560);
    const g = buildSpatialGraph(l);
    assert.equal(routeBetween(g, "room:A", "room:C"), null);
    assert.equal(circulationComponents(g).length, 2);
    const c = codes(l, { A: [rel("C", "access")], B: [], C: [] });
    assert.ok(c.includes("required-access-unmet"));
    assert.ok(c.includes("circulation-disconnected"));
  });

  it("access es dirigida: genera una sola evaluación (A→C), no una C→A", () => {
    const an = analyzeRelations(
      areas({ A: [rel("C", "access")], B: [], C: [] }),
    );
    const ev = evaluateRelations(buildSpatialGraph(handLayout()), an.relations);
    assert.equal(ev.length, 1);
    assert.deepEqual([ev[0].from, ev[0].to], ["A", "C"]);
  });

  it("preferred incumplida: advertencia, el layout no queda inválido", () => {
    const issues = validateLayout(handLayout(), {
      analysis: analyzeRelations(
        areas({ A: [rel("C", "adjacency", "preferred")], B: [], C: [] }),
      ),
    });
    const i = issues.find((x) => x.code === "preferred-adjacency-unmet")!;
    assert.equal(i.severity, "warning");
    assert.equal(i.category, "preference");
    assert.equal(layoutVerdict(issues), "valid-with-warnings");
  });

  it("sin analysis el validador no evalúa relaciones (comportamiento anterior)", () => {
    assert.deepEqual(validateLayout(handLayout()), []);
  });

  it("referencias inexistentes, autorreferencias y duplicados se reportan como datos (no se pierden en silencio)", () => {
    const issues = validateLayout(handLayout(), {
      analysis: analyzeRelations(
        areas({ A: [rel("zzz"), rel("A"), rel("B"), rel("B")], B: [], C: [] }),
      ),
    });
    const c = issues.map((i) => i.code);
    for (const k of [
      "UNKNOWN_TARGET",
      "SELF_RELATION",
      "DUPLICATE_RELATION",
    ] as const)
      assert.ok(c.includes(k), k);
    assert.ok(issues.filter((i) => i.category === "data").length >= 3);
  });

  it("geometría inválida → relaciones SIN EVALUAR (nunca cumplidas) y veredicto no válido", () => {
    const l = handLayout();
    l.areas[1] = { id: "B", x: 200, y: 40, width: 200, height: 200 }; // solapa con A
    const issues = validateLayout(l, {
      analysis: analyzeRelations(areas({ A: [rel("B")], B: [], C: [] })),
    });
    assert.ok(issues.some((i) => i.code === "overlap"));
    assert.ok(
      issues.some(
        (i) =>
          i.code === "relation-unevaluated" && i.relationId === "adjacency:A~B",
      ),
    );
    assert.ok(!issues.some((i) => i.code.startsWith("required-")));
    assert.equal(layoutVerdict(issues), "invalid");
  });

  it("relación sobre un área ausente del layout: sin evaluar, veredicto 'incomplete'", () => {
    const l = handLayout();
    const issues = validateLayout(l, {
      analysis: analyzeRelations([
        ...areas({ A: [rel("X")], B: [], C: [] }),
        { id: "X", relations: [] },
      ]),
    });
    assert.ok(issues.some((i) => i.code === "relation-unevaluated"));
    assert.equal(layoutVerdict(issues), "incomplete");
  });
});

describe("Fase 2 — imposibilidad demostrable vs incumplimiento", () => {
  it("K5 de adyacencia required es imposible (planaridad)", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const rs = analyzeRelations(
      ids.map((id, i) => ({
        id,
        relations: ids.slice(i + 1).map((t) => rel(t)),
      })),
    ).relations;
    const imp = findImpossibleRelations(
      rs,
      ids.map((id) => ({ id, width: 300, height: 300 })),
    );
    assert.equal(imp.length, 10);
    assert.ok(imp.every((i) => i.reason === "planarity"));
  });
  it("K4 NO es imposible", () => {
    const ids = ["a", "b", "c", "d"];
    const rs = analyzeRelations(
      ids.map((id, i) => ({
        id,
        relations: ids.slice(i + 1).map((t) => rel(t)),
      })),
    ).relations;
    assert.deepEqual(
      findImpossibleRelations(
        rs,
        ids.map((id) => ({ id, width: 300, height: 300 })),
      ),
      [],
    );
  });
  it("capacidad del perímetro: un área minúscula con demasiados vecinos required", () => {
    const rs = analyzeRelations([
      { id: "hub", relations: ["a", "b", "c"].map((t) => rel(t)) },
      ...["a", "b", "c"].map((id) => ({ id, relations: [] })),
    ]).relations;
    const imp = findImpossibleRelations(rs, [
      { id: "hub", width: 30, height: 30 },
      ...["a", "b", "c"].map((id) => ({ id, width: 200, height: 200 })),
    ]);
    assert.equal(imp.length, 3);
    assert.ok(imp.every((i) => i.reason === "perimeter"));
  });
  it("el escenario imposible se diagnostica como 'required-relation-impossible' y es inválido", () => {
    const w = LAYOUT_SCENARIOS.find((s) => s.id === "f2-impossible")!.build();
    const issues = validateLayout(new BuildingLayoutEngine().compute(w), {
      analysis: analyzeRelations(w.areas),
    });
    assert.ok(issues.some((i) => i.code === "required-relation-impossible"));
    assert.equal(layoutVerdict(issues), "invalid");
  });
});

describe("Fase 2 — validación geométrica de puertas, muros y límites", () => {
  const world = LAYOUT_SCENARIOS.find((s) => s.id === "f2-factory")!.build();
  const gen = () => new BuildingLayoutEngine().compute(world);

  it("el layout generado no tiene errores y sus muros dejan exactamente los huecos de las puertas", () => {
    assert.deepEqual(
      validateLayout(gen(), { analysis: analyzeRelations(world.areas) }).filter(
        (i) => i.severity !== "info",
      ),
      [],
    );
  });
  it("muro sobre una puerta → wall-blocks-opening", () => {
    const l = gen();
    const o = l.openings![0];
    l.walls = [
      ...l.walls!,
      o.orientation === "h"
        ? { x1: o.x, y1: o.y, x2: o.x + o.length, y2: o.y }
        : { x1: o.x, y1: o.y, x2: o.x, y2: o.y + o.length },
    ];
    assert.ok(validateLayout(l).some((i) => i.code === "wall-blocks-opening"));
  });
  it("falta un tramo de muro → wall-missing", () => {
    const l = gen();
    l.walls = l.walls!.slice(1);
    assert.ok(validateLayout(l).some((i) => i.code === "wall-missing"));
  });
  it("puerta fuera de los límites y habitación fuera de los límites", () => {
    const l = gen();
    l.openings![0] = { ...l.openings![0], x: -50 };
    assert.ok(
      validateLayout(l).some((i) => i.code === "opening-out-of-bounds"),
    );
    const m = gen();
    m.areas[0] = { ...m.areas[0], x: -10 };
    assert.ok(validateLayout(m).some((i) => i.code === "area-out-of-bounds"));
    assert.ok(
      validateLayout(gen(), {
        bounds: { x: 0, y: 0, width: 100, height: 100 },
      }).some((i) => i.code === "area-out-of-bounds"),
    );
  });
  it("cada puerta del layout generado conecta dos espacios distintos", () => {
    const g = buildSpatialGraph(gen());
    assert.ok(
      g.doors.length > 0 && g.doors.every((d) => d.valid && d.a !== d.b),
    );
  });
});

describe("Fase 2 — generación sobre escenarios", () => {
  const engine = new BuildingLayoutEngine();
  const f2 = LAYOUT_SCENARIOS.filter((s) => s.id.startsWith("f2-"));

  for (const s of f2) {
    it(`"${s.label}": sin errores geométricos, rooms alcanzables, sin pérdidas, relaciones solo 'cumplidas' con evidencia`, () => {
      const w = s.build();
      const l = engine.compute(w);
      const an = analyzeRelations(w.areas);
      const issues = validateLayout(l, { analysis: an });
      assert.deepEqual(
        issues.filter((i) => i.category === "geometry"),
        [],
      );
      assert.equal(l.areas.length, w.areas.length);
      assert.equal(l.entities.length, w.entities.length);
      assert.equal(l.roles.length, w.roleInstances.length);
      const g = buildSpatialGraph(l);
      assert.equal(circulationComponents(g).length, 1);
      for (const e of evaluateRelations(g, an.relations)) {
        if (e.status !== "satisfied") continue;
        if (e.type === "adjacency") assert.ok(e.evidence.sharedBorder! >= 60);
        if (e.type === "proximity")
          assert.ok(e.evidence.distance! <= e.evidence.range!);
        if (e.type === "access") assert.ok(e.evidence.route!.length >= 2);
      }
    });
  }

  it("las relaciones required realizables se cumplen (fábrica, escuela, pequeño, grande)", () => {
    for (const id of ["f2-factory", "f2-school", "f2-small", "f2-big"]) {
      const w = LAYOUT_SCENARIOS.find((s) => s.id === id)!.build();
      const issues = validateLayout(engine.compute(w), {
        analysis: analyzeRelations(w.areas),
      });
      assert.deepEqual(
        issues.filter((i) => i.severity === "error"),
        [],
        id,
      );
    }
  });

  it("la fábrica no queda en una sola hilera y producción–depósito–muelle son una cadena adyacente", () => {
    const w = LAYOUT_SCENARIOS.find((s) => s.id === "f2-factory")!.build();
    const l = engine.compute(w);
    assert.ok(new Set(l.areas.map((a) => a.y)).size > 1);
    const by = (id: string) => l.areas.find((a) => a.id === id)!;
    assert.ok(sharedBorder(by("produccion"), by("deposito")) >= 60);
    assert.ok(sharedBorder(by("deposito"), by("muelle")) >= 60);
  });

  it("no hay reglas por nombre/tipo: renombrar ids y tipos mantiene las relaciones cumplidas", () => {
    const base = LAYOUT_SCENARIOS.find((s) => s.id === "f2-factory")!.build();
    const renamed = JSON.parse(
      JSON.stringify(base)
        .replace(/muelle/g, "zz1")
        .replace(/deposito/g, "zz2"),
    );
    renamed.areas.forEach((a: { type: string }) => {
      a.type = "custom";
    });
    const w = WorldSchema.parse(renamed);
    const issues = validateLayout(engine.compute(w), {
      analysis: analyzeRelations(w.areas),
    });
    assert.deepEqual(
      issues.filter((i) => i.severity === "error"),
      [],
    );
  });

  it("determinista e inmutable", () => {
    const w = LAYOUT_SCENARIOS.find((s) => s.id === "f2-big")!.build();
    const before = JSON.stringify(w);
    const a = engine.compute(w);
    assert.equal(JSON.stringify(w), before);
    assert.deepEqual(engine.compute(w), a);
  });

  it("mundo sin relaciones: igual con y sin la nueva lógica (orden identidad, sin búsqueda)", () => {
    const w = LAYOUT_SCENARIOS.find((s) => s.id === "twelve")!.build();
    const l = engine.compute(w);
    assert.deepEqual(
      l.areas.map((a) => a.id),
      w.areas.map((a) => a.id),
    );
    assert.deepEqual(validateLayout(l), []);
  });

  for (const n of [0, 1, 2]) {
    it(`${n} áreas con relación required entre ellas: no falla`, () => {
      const specs = Array.from({ length: n }, (_, i) => ({
        id: `a${i}`,
        type: "office",
        name: `a${i}`,
        relations: i === 0 && n === 2 ? [rel("a1")] : [],
      }));
      const w: World = WorldSchema.parse({
        id: "w",
        metadata: { name: "T", createdAt: "x", updatedAt: "x" },
        environment: { id: "e", type: "custom", name: "E" },
        areas: specs,
      });
      const l = engine.compute(w);
      assert.equal(l.areas.length, n);
      const issues = validateLayout(l, { analysis: analyzeRelations(w.areas) });
      assert.deepEqual(
        issues.filter((i) => i.severity === "error"),
        [],
      );
    });
  }

  it("grupos separados: dos componentes de relaciones independientes se resuelven a la vez", () => {
    const w = WorldSchema.parse({
      id: "w",
      metadata: { name: "T", createdAt: "x", updatedAt: "x" },
      environment: { id: "e", type: "custom", name: "E" },
      areas: ["a", "b", "c", "d", "e", "f"].map((id) => ({
        id,
        type: "custom",
        name: id,
        relations:
          id === "a"
            ? [rel("b")]
            : id === "e"
              ? [rel("f", "proximity")]
              : id === "c"
                ? [rel("d")]
                : [],
      })),
    });
    const issues = validateLayout(engine.compute(w), {
      analysis: analyzeRelations(w.areas),
    });
    assert.deepEqual(
      issues.filter((i) => i.severity === "error"),
      [],
    );
  });
});

// ---------------------------------------------------------------------------------------
// Cierre de la Fase 2: cruces de circulación, solapes y veredictos
// ---------------------------------------------------------------------------------------

// Cruz: pasillo horizontal "h" y vertical "v" que se cortan; una habitación por cuadrante.
//   NW(40,40) NE(260,40)   h: y 200..260   v: x 200..260
//   SW(40,260) SE(260,260) (160x160 cada una)
const crossLayout = (): LayoutResult => ({
  areas: [
    { id: "NW", x: 40, y: 40, width: 160, height: 160 },
    { id: "NE", x: 260, y: 40, width: 160, height: 160 },
    { id: "SW", x: 40, y: 260, width: 160, height: 160 },
    { id: "SE", x: 260, y: 260, width: 160, height: 160 },
  ],
  entities: [],
  roles: [],
  circulation: [
    { id: "h", x: 40, y: 200, width: 380, height: 60 },
    { id: "v", x: 200, y: 40, width: 60, height: 380 },
  ],
  openings: [
    door("oNW", "NW", 100, 200),
    door("oNE", "NE", 320, 200),
    door("oSW", "SW", 100, 260),
    door("oSE", "SE", 320, 260),
  ],
});
const errorsOf = (l: LayoutResult) =>
  validateLayout(l).filter((i) => i.severity === "error");
const withWalls = (l: LayoutResult): LayoutResult => {
  const maxX = Math.max(
    ...[...l.areas, ...l.circulation!].map((r) => r.x + r.width),
  );
  const maxY = Math.max(
    ...[...l.areas, ...l.circulation!].map((r) => r.y + r.height),
  );
  const grid = new OccupancyGrid(maxX + GRID, maxY + GRID);
  l.circulation!.forEach((c) => grid.paint(c, CIRCULATION));
  l.areas.forEach((a, i) => grid.paint(a, FIRST_ROOM + i));
  return { ...l, walls: buildWalls(grid, l.openings!) };
};

describe("Cierre Fase 2 — solapamientos y cruces de circulación", () => {
  it("1. dos habitaciones sin solapamiento: válido", () => {
    assert.deepEqual(errorsOf(handLayout()), []);
  });
  it("2. dos habitaciones superpuestas: error", () => {
    const l = handLayout();
    l.areas[1] = { id: "B", x: 200, y: 40, width: 200, height: 200 };
    const i = validateLayout(l).find((x) => x.code === "overlap")!;
    assert.equal(i.severity, "error");
    assert.deepEqual(i.areaIds, ["A", "B"]);
  });
  it("3. habitación y pasillo superpuestos: error (un pasillo no atraviesa una habitación)", () => {
    const l = handLayout();
    l.circulation![0] = { id: "p0", x: 40, y: 200, width: 400, height: 60 }; // invade A y B
    assert.ok(validateLayout(l).some((i) => i.code === "overlap"));
    // y también cuando el pasillo cruza una habitación del layout en cruz
    const c = crossLayout();
    c.circulation![1] = { id: "v", x: 100, y: 40, width: 60, height: 380 }; // atraviesa NW y SW
    assert.ok(validateLayout(c).some((i) => i.code === "overlap"));
  });
  it("4. dos pasillos que se cruzan intencionalmente: sin falso error", () => {
    const issues = validateLayout(crossLayout());
    assert.deepEqual(issues, []);
    assert.equal(layoutVerdict(issues), "valid");
  });
  it("5. el cruce une la circulación en el grafo y en la grilla", () => {
    const l = withWalls(crossLayout());
    const g = buildSpatialGraph(l);
    assert.equal(circulationComponents(g).length, 1);
    assert.equal(junctionWidth(l.circulation![0], l.circulation![1]), 60);
    // grilla: sin 'unreachable', sin muro dentro del cruce ni huecos sin muro
    assert.deepEqual(validateLayout(l), []);
    // y una ruta entre cuadrantes opuestos cruza ambos pasillos
    const r = routeBetween(g, "room:NW", "room:SE")!;
    assert.deepEqual(r.spaces, ["room:NW", "corridor:h", "room:SE"]);
  });
  it("5b. uniones en T, en L y tramos colineales que se prolongan son válidos", () => {
    const h = { x: 40, y: 200, width: 200, height: 60 };
    const T = { x: 120, y: 260, width: 60, height: 200 }; // sale hacia abajo desde h
    const L = { x: 180, y: 140, width: 60, height: 60 }; // esquina sobre el extremo
    const collinear = { x: 200, y: 200, width: 200, height: 60 }; // prolonga h, solapa 40
    assert.ok(junctionWidth(h, T) === 0); // T solo TOCA h (no la solapa): contacto por borde
    const Tov = { x: 120, y: 240, width: 60, height: 220 }; // se mete 20 dentro de h
    assert.equal(junctionWidth(h, Tov), 0); // no cubre toda la sección de h (20 de 60)
    assert.equal(
      junctionWidth(h, { x: 120, y: 200, width: 60, height: 260 }),
      60,
    );
    assert.equal(junctionWidth(h, collinear), 40); // ancho de paso = solape (40)
    assert.equal(junctionWidth(h, L), 0); // solo se toca: contacto por borde, no cruce
  });
  it("6a. pasillos próximos pero separados por un hueco: no conectados", () => {
    const l = crossLayout();
    l.circulation![1] = { id: "v", x: 200, y: 280, width: 60, height: 140 }; // empieza 20 debajo de h
    // ajusta puertas para que sigan siendo válidas y solo importe la conexión
    const g = buildSpatialGraph(l);
    assert.equal(circulationComponents(g).length, 2);
    assert.ok(
      validateLayout(l).some((i) => i.code === "circulation-disconnected"),
    );
  });
  it("6b. pasillos que solo se tocan en una esquina: no conectados", () => {
    const l = crossLayout();
    l.circulation![1] = { id: "v", x: 420, y: 260, width: 60, height: 160 }; // esquina de h
    const g = buildSpatialGraph(l);
    assert.equal(circulationComponents(g).length, 2);
  });
  it("6c. pasillos paralelos desplazados que se solapan a medias: colisión (error)", () => {
    const l = handLayout(); // p0: y 240..300; se añade otro pasillo paralelo desplazado 30
    l.circulation!.push({ id: "p1", x: 40, y: 270, width: 400, height: 60 });
    const i = validateLayout(l).find(
      (x) => x.code === "overlap" && x.subject === "p0",
    );
    assert.ok(i);
    assert.match(i!.message, /sin formar una unión válida/);
    assert.equal(junctionWidth(l.circulation![0], l.circulation![1]), 0);
  });
  it("7. pasillo fuera de los límites: error", () => {
    const l = handLayout();
    l.circulation![0] = { id: "p0", x: -20, y: 240, width: 460, height: 60 };
    assert.ok(
      validateLayout(l).some(
        (i) => i.code === "area-out-of-bounds" && i.subject === "p0",
      ),
    );
    assert.ok(
      validateLayout(handLayout(), {
        bounds: { x: 0, y: 0, width: 300, height: 600 },
      }).some((i) => i.code === "area-out-of-bounds" && i.subject === "p0"),
    );
  });
  it("8. áreas degeneradas o con dimensiones inválidas: error", () => {
    for (const bad of [
      { id: "A", x: 40, y: 40, width: 0, height: 200 },
      { id: "A", x: 40, y: 40, width: -5, height: 200 },
      { id: "A", x: Number.NaN, y: 40, width: 200, height: 200 },
    ]) {
      const l = handLayout();
      l.areas[0] = bad;
      assert.ok(
        validateLayout(l).some((i) => i.code === "degenerate"),
        JSON.stringify(bad),
      );
    }
  });
});

describe("Cierre Fase 2 — relaciones sobre cruces y aislamiento", () => {
  it("13. acceso entre cuadrantes opuestos a través del cruce: satisfecho con ruta", () => {
    const an = analyzeRelations(
      areas({ NW: [rel("SE", "access")], NE: [], SW: [], SE: [] }),
    );
    const [e] = evaluateRelations(
      buildSpatialGraph(crossLayout()),
      an.relations,
    );
    assert.equal(e.status, "satisfied");
    assert.deepEqual(e.evidence.route, ["NW", "h", "SE"]);
    assert.equal(
      validateLayout(crossLayout(), { analysis: an }).filter(
        (i) => i.severity === "error",
      ).length,
      0,
    );
  });
  it("14/23. área aislada (sin puerta válida): no es accesible y se diagnostica", () => {
    const l = crossLayout();
    l.openings = l.openings!.filter((o) => o.areaId !== "SE");
    const an = analyzeRelations(
      areas({ NW: [rel("SE", "access")], NE: [], SW: [], SE: [] }),
    );
    const c = validateLayout(l, { analysis: an }).map((i) => i.code);
    assert.ok(c.includes("no-opening"));
    assert.ok(c.includes("unreachable"));
    assert.ok(c.includes("required-access-unmet"));
  });
  it("18. las relaciones dirigidas conservan from → to", () => {
    const an = analyzeRelations(
      areas({ NW: [rel("SE", "access")], NE: [], SW: [], SE: [] }),
    );
    assert.equal(an.relations[0].id, "access:NW->SE");
    const [e] = evaluateRelations(
      buildSpatialGraph(crossLayout()),
      an.relations,
    );
    assert.deepEqual([e.from, e.to], ["NW", "SE"]);
  });
  it("21/22. puerta sobre hueco real: válida; puerta bloqueada por muro: diagnóstico", () => {
    const l = withWalls(crossLayout());
    assert.deepEqual(validateLayout(l), []);
    const blocked: LayoutResult = {
      ...l,
      walls: [...l.walls!, { x1: 100, y1: 200, x2: 140, y2: 200 }],
    };
    assert.ok(
      validateLayout(blocked).some((i) => i.code === "wall-blocks-opening"),
    );
  });
});

describe("Cierre Fase 2 — validaciones de circulación y slots", () => {
  it("pasillo demasiado estrecho: error", () => {
    const l = handLayout();
    l.circulation![0] = { id: "p0", x: 40, y: 240, width: 400, height: 20 };
    const i = validateLayout(l).find(
      (x) => x.code === "circulation-too-narrow",
    );
    assert.ok(i);
    assert.equal(i!.severity, "error");
    assert.equal(i!.subject, "p0");
  });
  it("slot de entidad o rol fuera de su área: error con el área implicada", () => {
    const l = handLayout();
    l.entities = [
      { id: "e1", areaId: "A", x: 30, y: 50, width: 80, height: 70 }, // sale por la izquierda
      { id: "e2", areaId: "B", x: 260, y: 60, width: 80, height: 70 }, // dentro
    ];
    l.roles = [
      { id: "r1", areaId: "C", x: 100, y: 450, width: 80, height: 70 },
    ]; // sale por abajo
    const out = validateLayout(l).filter((x) => x.code === "slot-outside-area");
    assert.deepEqual(out.map((x) => x.subject).sort(), ["e1", "r1"]);
    assert.deepEqual(out.map((x) => x.areaIds).sort(), [["A"], ["C"]]);
  });
});

describe("Cierre Fase 2 — veredicto global y compatibilidad", () => {
  const issue = (over: Partial<LayoutIssue>): LayoutIssue => ({
    code: "overlap",
    subject: "x",
    message: "",
    severity: "error",
    category: "geometry",
    areaIds: [],
    ...over,
  });
  it("29. valid / valid-with-warnings / incomplete / invalid", () => {
    assert.equal(layoutVerdict([]), "valid");
    assert.equal(
      layoutVerdict([issue({ severity: "info", category: "info" })]),
      "valid",
    );
    assert.equal(
      layoutVerdict([
        issue({
          code: "preferred-adjacency-unmet",
          severity: "warning",
          category: "preference",
        }),
      ]),
      "valid-with-warnings",
    );
    assert.equal(
      layoutVerdict([
        issue({
          code: "relation-unevaluated",
          severity: "warning",
          category: "semantic",
        }),
      ]),
      "incomplete",
    );
    assert.equal(layoutVerdict([issue({})]), "invalid");
    // un error pesa más que un 'incomplete'
    assert.equal(
      layoutVerdict([
        issue({
          code: "relation-unevaluated",
          severity: "warning",
          category: "semantic",
        }),
        issue({}),
      ]),
      "invalid",
    );
  });
  it("27/28. validación determinista y sin mutar la entrada", () => {
    const l = crossLayout();
    const an = analyzeRelations(
      areas({ NW: [rel("SE", "access")], NE: [], SW: [], SE: [] }),
    );
    const before = JSON.stringify([l, an]);
    const a = validateLayout(l, { analysis: an });
    const b = validateLayout(l, { analysis: an });
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify([l, an]), before);
  });
  it("25/26. todos los escenarios existentes: sin pérdidas y sin errores geométricos", () => {
    const engine = new BuildingLayoutEngine();
    for (const s of LAYOUT_SCENARIOS) {
      const w = s.build();
      const l = engine.compute(w);
      assert.equal(l.areas.length, w.areas.length, s.id);
      assert.equal(l.entities.length, w.entities.length, s.id);
      assert.equal(l.roles.length, w.roleInstances.length, s.id);
      assert.deepEqual(
        validateLayout(l, { analysis: analyzeRelations(w.areas) }).filter(
          (i) => i.category === "geometry",
        ),
        [],
        s.id,
      );
    }
  });
});
