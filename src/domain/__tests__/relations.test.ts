import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AreaRelationSchema, AreaSchema } from "../world/area";
import { WorldSchema, type World } from "../world/world";
import { WorldEngine } from "../../engine/world/worldEngine";
import { simulateCommands } from "../../engine/world/simulateCommands";
import { InvalidAreaRelationError } from "../../engine/world/errors";
import { AIProposalSchema } from "../../application/ai/proposal";
import { compileOperations } from "../../application/ai/compileOperations";
import { buildSystemPrompt } from "../../application/ai/prompt";
import {
  buildWorldContext,
  WorldContextSchema,
} from "../../application/ai/worldContext";
import { parseProposalText } from "../../application/ai/interpretInstruction";
import { BuildingLayoutEngine } from "../../engine/layout/BuildingLayoutEngine";
import { validateLayout } from "../../engine/layout/validateLayout";
import {
  serializeWorld,
  deserializeWorld,
} from "../../application/persistence/serialization";

const base = (areas: unknown[]): unknown => ({
  id: "w",
  metadata: { name: "T", createdAt: "x", updatedAt: "x" },
  environment: { id: "e", type: "custom", name: "E" },
  areas,
});
const area = (id: string, relations?: unknown[]) => ({
  id,
  type: "custom",
  name: id,
  relations,
});
const rel = (
  targetAreaId: string,
  type = "adjacency",
  strength = "preferred",
) => ({
  targetAreaId,
  type,
  strength,
});

describe("FASE 0.1 — relaciones: dominio", () => {
  it("un área sin 'relations' (mundo antiguo) queda con []", () => {
    assert.deepEqual(
      AreaSchema.parse({ id: "a", type: "office", name: "A" }).relations,
      [],
    );
    const w = WorldSchema.parse(base([{ id: "a", type: "office", name: "A" }]));
    assert.deepEqual(w.areas[0].relations, []);
  });

  it("un JSON persistido antes de las relaciones sigue cargando (round-trip)", () => {
    const legacy = JSON.parse(
      serializeWorld(WorldSchema.parse(base([area("a"), area("b")]))),
    );
    legacy.world.areas.forEach(
      (a: Record<string, unknown>) => delete a.relations,
    );
    const loaded = deserializeWorld(JSON.stringify(legacy));
    assert.deepEqual(
      loaded.areas.map((a) => a.relations),
      [[], []],
    );
    assert.deepEqual(deserializeWorld(serializeWorld(loaded)), loaded);
  });

  it("acepta los 3 tipos y las 2 importancias", () => {
    for (const type of ["adjacency", "proximity", "access"]) {
      for (const strength of ["preferred", "required"]) {
        const w = WorldSchema.parse(
          base([area("a", [rel("b", type, strength)]), area("b")]),
        );
        assert.equal(w.areas[0].relations[0].type, type);
        assert.equal(w.areas[0].relations[0].strength, strength);
      }
    }
  });

  it("rechaza tipo, importancia o destino mal formados", () => {
    for (const bad of [
      rel("b", "teleport"),
      rel("b", "access", "mandatory"),
      rel(""),
      { type: "access", strength: "required" },
      "b",
    ]) {
      assert.throws(() =>
        WorldSchema.parse(base([area("a", [bad]), area("b")])),
      );
    }
  });

  it("rechaza destinos inexistentes y autorreferencias", () => {
    assert.throws(
      () => WorldSchema.parse(base([area("a", [rel("fantasma")])])),
      /no existe/,
    );
    assert.throws(
      () => WorldSchema.parse(base([area("a", [rel("a")])])),
      /consigo misma/,
    );
  });

  it("rechaza relaciones duplicadas (mismo destino y tipo) pero admite tipos distintos al mismo destino", () => {
    assert.throws(() =>
      WorldSchema.parse(
        base([
          area("a", [
            rel("b", "access", "preferred"),
            rel("b", "access", "required"),
          ]),
          area("b"),
        ]),
      ),
    );
    assert.doesNotThrow(() =>
      WorldSchema.parse(
        base([
          area("a", [rel("b", "access"), rel("b", "proximity")]),
          area("b"),
        ]),
      ),
    );
  });

  it("no asume reciprocidad: a→b no crea b→a", () => {
    const w = WorldSchema.parse(base([area("a", [rel("b")]), area("b")]));
    assert.deepEqual(w.areas[1].relations, []);
  });

  it("el dominio no contiene geometría", () => {
    const keys = Object.keys(AreaRelationSchema.shape).sort();
    assert.deepEqual(keys, ["strength", "targetAreaId", "type"]);
  });
});

describe("FASE 0.1 — relaciones: WorldEngine", () => {
  const engine = () =>
    new WorldEngine(WorldSchema.parse(base([area("a"), area("b")])) as World);

  it("addArea acepta relaciones hacia áreas existentes", () => {
    const e = engine();
    e.addArea(area("c", [rel("a"), rel("b", "access", "required")]));
    assert.equal(e.getWorld().areas[2].relations.length, 2);
  });

  it("addArea rechaza destinos inexistentes y autorreferencias", () => {
    assert.throws(
      () => engine().addArea(area("c", [rel("zz")])),
      InvalidAreaRelationError,
    );
    assert.throws(
      () => engine().addArea(area("c", [rel("c")])),
      InvalidAreaRelationError,
    );
  });

  it("removeArea elimina las relaciones que apuntaban al área (sin referencias colgantes)", () => {
    const e = new WorldEngine(
      WorldSchema.parse(base([area("a"), area("b", [rel("a")])])),
    );
    e.removeArea("a");
    assert.deepEqual(e.getWorld().areas[0].relations, []);
    assert.doesNotThrow(() => WorldSchema.parse(e.getWorld()));
  });
});

describe("FASE 0.1 — relaciones: IA", () => {
  const world = WorldSchema.parse(base([area("a"), area("b")]));
  const addArea = (id: string, relations?: unknown[]) => ({
    type: "ADD_AREA",
    area: { id, type: "custom", name: id, relations },
  });
  const proposal = (operations: unknown[]) =>
    parseProposalText(
      JSON.stringify({ version: 1, status: "ok", summary: "s", operations }),
    );
  const apply = (ops: unknown[]) => {
    const p = proposal(ops);
    assert.equal(p.status, "ok");
    if (p.status !== "ok") throw new Error();
    return simulateCommands(world, compileOperations(p.operations, world));
  };

  it("una propuesta sin relaciones sigue siendo válida (compatibilidad)", () => {
    const r = apply([addArea("nueva")]);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.world.areas.at(-1)!.relations, []);
  });

  it("acepta relaciones y las reescribe con los ids normalizados", () => {
    const r = apply([addArea("Zona Nueva", [rel("a", "access", "required")])]);
    assert.ok(r.ok);
    if (r.ok)
      assert.deepEqual(r.world.areas.at(-1)!.relations, [
        rel("a", "access", "required"),
      ]);
  });

  it("relaciones hacia áreas creadas MÁS ADELANTE en la misma propuesta se resuelven", () => {
    const r = apply([addArea("x", [rel("y")]), addArea("y")]);
    assert.ok(r.ok, JSON.stringify(r));
    if (r.ok) {
      assert.deepEqual(
        r.world.areas.map((a) => a.id),
        ["a", "b", "y", "x"],
      );
      assert.deepEqual(r.world.areas.at(-1)!.relations, [rel("y")]);
    }
  });

  it("ciclos (x→y, y→x) no rompen la propuesta: se conserva una relación", () => {
    const r = apply([addArea("x", [rel("y")]), addArea("y", [rel("x")])]);
    assert.ok(r.ok, JSON.stringify(r));
  });

  it("referencias inexistentes y autorreferencias de la IA se descartan sin fallar la propuesta", () => {
    const r = apply([
      addArea("x", [
        rel("fantasma"),
        rel("x"),
        rel("a"),
        rel("b", "proximity"),
      ]),
    ]);
    assert.ok(r.ok, JSON.stringify(r));
    if (r.ok) {
      assert.deepEqual(r.world.areas.at(-1)!.relations, [
        rel("a"),
        rel("b", "proximity"),
      ]);
    }
  });

  it("una propuesta con relaciones duplicadas se rechaza como inválida (no llega al mundo)", () => {
    assert.throws(
      () => proposal([addArea("x", [rel("a"), rel("a")])]),
      /duplicada/,
    );
  });

  it("una relación hacia un área que la misma propuesta elimina se descarta", () => {
    const r = apply([
      addArea("x", [rel("a")]),
      { type: "REMOVE_AREA", areaId: "a" },
    ]);
    assert.ok(r.ok, JSON.stringify(r));
    if (r.ok) assert.deepEqual(r.world.areas.at(-1)!.relations, []);
  });

  it("el esquema de la IA rechaza coordenadas dentro de una relación y claves extra", () => {
    const bad = (extra: object) =>
      AIProposalSchema.safeParse({
        version: 1,
        status: "ok",
        summary: "s",
        operations: [addArea("x", [{ ...rel("a"), ...extra }])],
      }).success;
    // las relaciones solo tienen 3 campos: los extra se eliminan al parsear (no llegan al dominio)
    assert.ok(bad({ x: 10, y: 20 }));
    const parsed = AIProposalSchema.parse({
      version: 1,
      status: "ok",
      summary: "s",
      operations: [addArea("x", [{ ...rel("a"), x: 10 }])],
    });
    assert.ok(parsed.status === "ok");
    assert.ok(
      !(
        "x" in
        (parsed.operations[0] as { area: { relations: object[] } }).area
          .relations[0]
      ),
    );
    // y la propia área no admite coordenadas
    assert.ok(
      !AIProposalSchema.safeParse({
        version: 1,
        status: "ok",
        summary: "s",
        operations: [
          {
            type: "ADD_AREA",
            area: { id: "x", type: "custom", name: "x", x: 5 },
          },
        ],
      }).success,
    );
  });

  it("el prompt explica relaciones y prohíbe geometría; aparece en ambos modos", () => {
    for (const mode of ["modify", "generate"] as const) {
      const p = buildSystemPrompt(mode);
      for (const t of [
        "adjacency",
        "proximity",
        "access",
        "preferred",
        "required",
        "relations",
      ]) {
        assert.ok(p.includes(t), `${mode}: falta ${t}`);
      }
      assert.match(p, /NO crea puertas ni pasillos/);
      assert.match(p, /nunca posiciones/);
    }
  });

  it("el contexto semántico de la IA incluye las relaciones y es retrocompatible", () => {
    const w = WorldSchema.parse(base([area("a", [rel("b")]), area("b")]));
    const ctx = buildWorldContext(w);
    assert.deepEqual(ctx.areas[0].relations, [rel("b")]);
    const legacy = JSON.parse(JSON.stringify(ctx));
    legacy.areas.forEach(
      (a: Record<string, unknown>) => delete a.relations,
    );
    assert.deepEqual(WorldContextSchema.parse(legacy).areas[0].relations, []);
  });
});

describe("FASE 0.1 — relaciones: integración con el layout", () => {
  it("un mundo con relaciones mantiene un layout válido y no modifica las relaciones", () => {
    const specs = Array.from({ length: 6 }, (_, i) =>
      area(
        `a${i + 1}`,
        i === 0
          ? [rel("a6", "access", "required"), rel("a3", "proximity")]
          : [],
      ),
    );
    const w = WorldSchema.parse(base(specs));
    const before = JSON.stringify(w);
    const layout = new BuildingLayoutEngine().compute(w);
    assert.equal(JSON.stringify(w), before);
    assert.deepEqual(validateLayout(layout), []);
    assert.equal(layout.areas.length, 6);
  });
});
