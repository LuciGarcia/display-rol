import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeRelations, type AnalyzableArea } from "../relationAnalysis";
import { orderByRelations } from "../../layout/relationOrder";
import {
  isSymmetricRelationType,
  type AreaRelation,
} from "../../../domain/world/area";
import { BuildingLayoutEngine } from "../../layout/BuildingLayoutEngine";
import { validateLayout } from "../../layout/validateLayout";
import { WorldSchema } from "../../../domain/world/world";

type Type = AreaRelation["type"];
type Strength = AreaRelation["strength"];
const rel = (
  targetAreaId: string,
  type: Type = "adjacency",
  strength: Strength = "preferred",
): AreaRelation => ({
  targetAreaId,
  type,
  strength,
});
const area = (id: string, ...relations: AreaRelation[]): AnalyzableArea => ({
  id,
  relations,
});
const ids = (...n: string[]) => n.map((id) => area(id));
const codes = (a: ReturnType<typeof analyzeRelations>) =>
  a.diagnostics.map((d) => d.code);

describe("FASE 1 — semántica y direccionalidad", () => {
  it("adjacency y proximity son simétricas; access es dirigida", () => {
    assert.equal(isSymmetricRelationType("adjacency"), true);
    assert.equal(isSymmetricRelationType("proximity"), true);
    assert.equal(isSymmetricRelationType("access"), false);
  });
});

describe("FASE 1 — mundos básicos", () => {
  it("sin áreas", () => {
    const r = analyzeRelations([]);
    assert.deepEqual(r, {
      relations: [],
      areas: [],
      groups: { symmetric: [], directed: [], isolated: [] },
      priorityOrder: [],
      diagnostics: [],
    });
  });

  it("una sola área", () => {
    const r = analyzeRelations(ids("a"));
    assert.deepEqual(r.groups.isolated, ["a"]);
    assert.deepEqual(r.diagnostics, []);
  });

  it("varias áreas sin relaciones: todas aisladas y SIN ruido de diagnósticos (mundos antiguos)", () => {
    const r = analyzeRelations(ids("c", "a", "b"));
    assert.deepEqual(r.groups.isolated, ["a", "b", "c"]);
    assert.deepEqual(r.diagnostics, []);
    assert.deepEqual(r.priorityOrder, ["a", "b", "c"]);
  });

  it("áreas aisladas junto a un grupo conectado", () => {
    const r = analyzeRelations([
      area("a", rel("b")),
      area("b"),
      area("c"),
      area("d"),
    ]);
    assert.deepEqual(r.groups.symmetric, [["a", "b"]]);
    assert.deepEqual(r.groups.isolated, ["c", "d"]);
    assert.deepEqual(
      r.diagnostics
        .filter((d) => d.code === "ISOLATED_AREA")
        .map((d) => d.areaIds[0]),
      ["c", "d"],
    );
  });
});

describe("FASE 1 — normalización", () => {
  it("simétrica declarada una vez: una relación, from<to, id estable", () => {
    const r = analyzeRelations([area("z", rel("a", "proximity")), area("a")]);
    assert.equal(r.relations.length, 1);
    assert.deepEqual(
      {
        id: r.relations[0].id,
        from: r.relations[0].from,
        to: r.relations[0].to,
        directed: r.relations[0].directed,
        by: r.relations[0].declaredBy,
      },
      { id: "proximity:a~z", from: "a", to: "z", directed: false, by: ["z"] },
    );
    assert.deepEqual(r.diagnostics, []);
  });

  it("simétrica declarada desde ambos extremos: se fusiona y avisa REDUNDANT_SYMMETRIC", () => {
    const r = analyzeRelations([
      area("a", rel("b", "adjacency")),
      area("b", rel("a", "adjacency")),
    ]);
    assert.equal(r.relations.length, 1);
    assert.deepEqual(r.relations[0].declaredBy, ["a", "b"]);
    assert.deepEqual(codes(r), ["REDUNDANT_SYMMETRIC"]);
    assert.equal(r.diagnostics[0].level, "warning");
  });

  it("access en sentidos opuestos: DOS relaciones dirigidas, sin conflicto ni aviso", () => {
    const r = analyzeRelations([
      area("a", rel("b", "access")),
      area("b", rel("a", "access")),
    ]);
    assert.deepEqual(
      r.relations.map((x) => x.id),
      ["access:a->b", "access:b->a"],
    );
    assert.ok(r.relations.every((x) => x.directed));
    assert.deepEqual(r.diagnostics, []);
    assert.deepEqual(r.groups.directed, [["a", "b"]]);
  });

  it("access conserva la dirección: a→b no crea b→a", () => {
    const r = analyzeRelations([area("a", rel("b", "access")), area("b")]);
    assert.deepEqual(
      r.relations.map((x) => [x.from, x.to]),
      [["a", "b"]],
    );
    const stats = Object.fromEntries(r.areas.map((s) => [s.areaId, s]));
    assert.deepEqual(
      [stats.a.outgoing, stats.a.incoming, stats.b.outgoing, stats.b.incoming],
      [1, 0, 0, 1],
    );
  });

  it("tipos distintos entre los mismos extremos NO se fusionan ni se marcan como conflicto", () => {
    const r = analyzeRelations([
      area(
        "a",
        rel("b", "adjacency"),
        rel("b", "access"),
        rel("b", "proximity"),
      ),
      area("b"),
    ]);
    assert.equal(r.relations.length, 3);
    assert.deepEqual(r.diagnostics, []);
  });

  it("misma relación con importancias distintas: gana required y avisa STRENGTH_MISMATCH", () => {
    const r = analyzeRelations([
      area("a", rel("b", "adjacency", "preferred")),
      area("b", rel("a", "adjacency", "required")),
    ]);
    assert.equal(r.relations[0].strength, "required");
    assert.ok(codes(r).includes("STRENGTH_MISMATCH"));
  });

  it("duplicado del mismo origen (dato sin validar): DUPLICATE_RELATION, una sola relación", () => {
    const r = analyzeRelations([area("a", rel("b"), rel("b")), area("b")]);
    assert.equal(r.relations.length, 1);
    assert.deepEqual(codes(r), ["DUPLICATE_RELATION"]);
  });

  it("destino inexistente: error de datos, la relación se excluye y el resto se analiza", () => {
    const r = analyzeRelations([
      area("a", rel("fantasma"), rel("b")),
      area("b"),
    ]);
    assert.deepEqual(
      r.relations.map((x) => x.id),
      ["adjacency:a~b"],
    );
    const e = r.diagnostics.find((d) => d.code === "UNKNOWN_TARGET")!;
    assert.equal(e.level, "error");
    assert.deepEqual(e.areaIds, ["a", "fantasma"]);
  });

  it("autorreferencia: error de datos y se excluye", () => {
    const r = analyzeRelations([area("a", rel("a", "access"))]);
    assert.deepEqual(r.relations, []);
    assert.deepEqual(codes(r), ["SELF_RELATION"]);
    assert.equal(r.diagnostics[0].level, "error");
  });

  it("ids de área repetidos: error DUPLICATE_AREA_ID y sigue funcionando", () => {
    const r = analyzeRelations([area("a", rel("b")), area("a"), area("b")]);
    assert.ok(codes(r).includes("DUPLICATE_AREA_ID"));
    assert.equal(r.areas.length, 2);
    assert.equal(r.relations.length, 1);
  });
});

describe("FASE 1 — agrupaciones", () => {
  it("dos áreas relacionadas", () => {
    assert.deepEqual(
      analyzeRelations([area("a", rel("b")), area("b")]).groups.symmetric,
      [["a", "b"]],
    );
  });

  it("cadena a–b–c–d en un solo grupo", () => {
    const r = analyzeRelations([
      area("a", rel("b")),
      area("b", rel("c", "proximity")),
      area("c", rel("d")),
      area("d"),
    ]);
    assert.deepEqual(r.groups.symmetric, [["a", "b", "c", "d"]]);
  });

  it("ciclo a–b–c–a: un grupo, sin diagnósticos (un ciclo no es un error)", () => {
    const r = analyzeRelations([
      area("a", rel("b")),
      area("b", rel("c")),
      area("c", rel("a")),
    ]);
    assert.deepEqual(r.groups.symmetric, [["a", "b", "c"]]);
    assert.deepEqual(r.diagnostics, []);
  });

  it("grupos separados", () => {
    const r = analyzeRelations([
      area("a", rel("b")),
      area("b"),
      area("c", rel("d")),
      area("d"),
      area("e"),
    ]);
    assert.deepEqual(r.groups.symmetric, [
      ["a", "b"],
      ["c", "d"],
    ]);
    assert.deepEqual(r.groups.isolated, ["e"]);
  });

  it("access NO crea grupos simétricos y sus áreas no están aisladas", () => {
    const r = analyzeRelations([
      area("a", rel("b", "access")),
      area("b"),
      area("c"),
    ]);
    assert.deepEqual(r.groups.symmetric, []);
    assert.deepEqual(r.groups.directed, [["a", "b"]]);
    assert.deepEqual(r.groups.isolated, ["c"]);
  });

  it("los grupos simétricos y dirigidos son independientes (no se unen por mezclar tipos)", () => {
    const r = analyzeRelations([
      area("a", rel("b", "adjacency")),
      area("b"),
      area("c", rel("d", "access")),
      area("d"),
    ]);
    assert.deepEqual(r.groups.symmetric, [["a", "b"]]);
    assert.deepEqual(r.groups.directed, [["c", "d"]]);
  });

  it("relaciones simétricas redundantes no cambian los grupos", () => {
    const once = analyzeRelations([area("a", rel("b")), area("b")]);
    const twice = analyzeRelations([area("a", rel("b")), area("b", rel("a"))]);
    assert.deepEqual(twice.groups, once.groups);
  });
});

describe("FASE 1 — prioridades y diagnósticos", () => {
  it("required se atiende antes que preferred; luego tipo; luego ids", () => {
    const r = analyzeRelations([
      area(
        "a",
        rel("b", "proximity", "preferred"),
        rel("c", "adjacency", "preferred"),
        rel("d", "access", "required"),
      ),
      area("b"),
      area("c"),
      area("d"),
    ]);
    assert.deepEqual(
      r.relations.map((x) => x.id),
      ["access:a->d", "adjacency:a~c", "proximity:a~b"],
    );
  });

  it("priorityOrder: más required, luego más relaciones, luego id; aisladas al final", () => {
    const r = analyzeRelations([
      area("a", rel("b")),
      area("b", rel("c", "adjacency", "required")),
      area("c"),
      area("d", rel("a", "proximity")),
      area("z"),
    ]);
    // b y c tienen 1 required; b tiene grado 2, c grado 1; a grado 2 (sin required); d grado 1; z aislada
    assert.deepEqual(r.priorityOrder, ["b", "c", "a", "d", "z"]);
  });

  it("las áreas con más relaciones no se interpretan como 'centro': solo cuentan para el orden de atención", () => {
    const r = analyzeRelations([
      area("hub", rel("a"), rel("b"), rel("c")),
      area("a"),
      area("b"),
      area("c"),
    ]);
    assert.equal(r.priorityOrder[0], "hub");
    assert.ok(!JSON.stringify(r).match(/"(x|y|width|height|position)"/));
  });

  it("cada required genera un REQUIRED_PENDING (level pending), nunca satisfecho ni incumplido", () => {
    const r = analyzeRelations([
      area(
        "a",
        rel("b", "adjacency", "required"),
        rel("c", "access", "required"),
        rel("d", "proximity", "preferred"),
      ),
      area("b"),
      area("c"),
      area("d"),
    ]);
    const pending = r.diagnostics.filter((d) => d.code === "REQUIRED_PENDING");
    assert.equal(pending.length, 2);
    assert.ok(pending.every((d) => d.level === "pending" && d.relationId));
    assert.match(
      pending.find((d) => d.relationId === "access:a->c")!.message,
      /conectividad/,
    );
    assert.match(
      pending.find((d) => d.relationId === "adjacency:a~b")!.message,
      /límite/,
    );
    assert.ok(!r.diagnostics.some((d) => d.level === "error"));
  });

  it("los diagnósticos se ordenan: error, warning, pending", () => {
    const r = analyzeRelations([
      area("a", rel("zz"), rel("b", "adjacency", "required")),
      area("b", rel("a", "adjacency", "required")),
      area("c"),
    ]);
    const levels = r.diagnostics.map((d) => d.level);
    assert.deepEqual(
      levels,
      [...levels].sort(
        (x, y) =>
          ["error", "warning", "pending"].indexOf(x) -
          ["error", "warning", "pending"].indexOf(y),
      ),
    );
    assert.deepEqual(codes(r), [
      "UNKNOWN_TARGET",
      "ISOLATED_AREA",
      "REDUNDANT_SYMMETRIC",
      "REQUIRED_PENDING",
    ]);
  });

  it("estadísticas por área", () => {
    const r = analyzeRelations([
      area(
        "a",
        rel("b", "adjacency", "required"),
        rel("c", "access", "preferred"),
      ),
      area("b"),
      area("c"),
    ]);
    assert.deepEqual(
      r.areas.find((s) => s.areaId === "a"),
      {
        areaId: "a",
        required: 1,
        preferred: 1,
        degree: 2,
        symmetric: 1,
        outgoing: 1,
        incoming: 0,
      },
    );
  });
});

describe("FASE 1 — determinismo e inmutabilidad", () => {
  const base = [
    area("a", rel("b", "adjacency", "required"), rel("c", "access")),
    area("b", rel("a", "adjacency"), rel("d", "proximity")),
    area("c"),
    area("d", rel("zz")),
    area("e"),
  ];

  it("dos ejecuciones producen resultados idénticos", () => {
    assert.deepEqual(analyzeRelations(base), analyzeRelations(base));
  });

  it("el resultado NO depende del orden de las áreas ni de las relaciones", () => {
    const expected = analyzeRelations(base);
    const shuffled = [...base]
      .reverse()
      .map((a) => ({ ...a, relations: [...a.relations].reverse() }));
    assert.deepEqual(analyzeRelations(shuffled), expected);
    const rotated = [...base.slice(2), ...base.slice(0, 2)];
    assert.deepEqual(analyzeRelations(rotated), expected);
  });

  it("no modifica la entrada", () => {
    const copy = JSON.stringify(base);
    analyzeRelations(base);
    assert.equal(JSON.stringify(base), copy);
  });

  it("la salida no comparte referencias con la entrada", () => {
    const r = analyzeRelations(base);
    r.relations.forEach((x) => x.declaredBy.push("x"));
    assert.equal(JSON.stringify(base).includes('"x"'), false);
  });
});

describe("FASE 1 — integración con el layout", () => {
  const world = (specs: AnalyzableArea[]) =>
    WorldSchema.parse({
      id: "w",
      metadata: { name: "T", createdAt: "x", updatedAt: "x" },
      environment: { id: "e", type: "custom", name: "E" },
      areas: specs.map((s) => ({
        id: s.id,
        type: "custom",
        name: s.id,
        relations: s.relations,
      })),
    });

  it("orderByRelations reutiliza un análisis ya calculado y da el mismo orden", () => {
    const w = world([
      area("a1", rel("a5")),
      ...["a2", "a3", "a4", "a5"].map((i) => area(i)),
    ]);
    const analysis = analyzeRelations(w.areas);
    assert.deepEqual(
      orderByRelations(w.areas, analysis),
      orderByRelations(w.areas),
    );
  });

  it("mundos sin relaciones conservan el orden de entrada", () => {
    assert.deepEqual(orderByRelations(ids("x", "y", "z")), [0, 1, 2]);
  });

  it("una simétrica declarada desde ambos lados pesa igual que declarada una vez", () => {
    const once = orderByRelations([
      area("a"),
      area("b"),
      area("c", rel("a")),
      area("d"),
    ]);
    const twice = orderByRelations([
      area("a", rel("c")),
      area("b"),
      area("c", rel("a")),
      area("d"),
    ]);
    assert.deepEqual(once, twice);
  });

  it("el layout con relaciones sigue siendo válido y el análisis no cambia pasillos y access añade como mucho una puerta directa", () => {
    const specs = [
      area(
        "a1",
        rel("a6", "access", "required"),
        rel("a3", "adjacency", "required"),
      ),
      ...["a2", "a3", "a4", "a5", "a6", "a7"].map((i) => area(i)),
    ];
    const engine = new BuildingLayoutEngine();
    const withRel = engine.compute(world(specs));
    const without = engine.compute(world(specs.map((s) => area(s.id))));
    assert.deepEqual(validateLayout(withRel), []);
    const extra = withRel.openings!.length - without.openings!.length;
    assert.ok(extra === 0 || extra === 1);
    assert.equal(withRel.circulation!.length, without.circulation!.length);
  });
});
