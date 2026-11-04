import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BuildingLayoutEngine } from "../BuildingLayoutEngine";
import { layoutVerdict, validateLayout } from "../validateLayout";
import {
  evaluateRelations,
  findImpossibleRelations,
} from "../relationEvaluation";
import {
  buildSpatialGraph,
  circulationComponents,
  routeBetween,
} from "../spatialGraph";
import { edgeDistance, proximityRange, sharedBorder } from "../spatialCriteria";
import { analyzeRelations } from "../../spatial/relationAnalysis";
import { WorldSchema, type World } from "../../../domain/world/world";
import { DEV_SCENARIOS } from "../../../app/dev/world/scenarios";
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
    const w = DEV_SCENARIOS.find((s) => s.id === "f2-impossible")!.build();
    const issues = validateLayout(new BuildingLayoutEngine().compute(w), {
      analysis: analyzeRelations(w.areas),
    });
    assert.ok(issues.some((i) => i.code === "required-relation-impossible"));
    assert.equal(layoutVerdict(issues), "invalid");
  });
});

describe("Fase 2 — validación geométrica de puertas, muros y límites", () => {
  const world = DEV_SCENARIOS.find((s) => s.id === "f2-factory")!.build();
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
  const f2 = DEV_SCENARIOS.filter((s) => s.id.startsWith("f2-"));

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
      const w = DEV_SCENARIOS.find((s) => s.id === id)!.build();
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
    const w = DEV_SCENARIOS.find((s) => s.id === "f2-factory")!.build();
    const l = engine.compute(w);
    assert.ok(new Set(l.areas.map((a) => a.y)).size > 1);
    const by = (id: string) => l.areas.find((a) => a.id === id)!;
    assert.ok(sharedBorder(by("produccion"), by("deposito")) >= 60);
    assert.ok(sharedBorder(by("deposito"), by("muelle")) >= 60);
  });

  it("no hay reglas por nombre/tipo: renombrar ids y tipos mantiene las relaciones cumplidas", () => {
    const base = DEV_SCENARIOS.find((s) => s.id === "f2-factory")!.build();
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
    const w = DEV_SCENARIOS.find((s) => s.id === "f2-big")!.build();
    const before = JSON.stringify(w);
    const a = engine.compute(w);
    assert.equal(JSON.stringify(w), before);
    assert.deepEqual(engine.compute(w), a);
  });

  it("mundo sin relaciones: igual con y sin la nueva lógica (orden identidad, sin búsqueda)", () => {
    const w = DEV_SCENARIOS.find((s) => s.id === "twelve")!.build();
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
