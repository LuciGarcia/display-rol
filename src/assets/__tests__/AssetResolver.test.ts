import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AssetResolver } from "../AssetResolver";
import { defaultAssetDefinitions } from "../registry";
import { resolveWorldAssets } from "../resolveWorldAssets";
import type {
  AssetCategory,
  AssetDefinition,
  AssetRepresentation,
} from "../types";
import { WorldSchema } from "../../domain/world/world";

const def = (
  id: string,
  type: string,
  state: string,
  representation: AssetRepresentation = "2d",
  category: AssetCategory = "entity",
): AssetDefinition => ({
  id,
  category,
  semanticType: type,
  state,
  representation,
  kind: representation === "3d" ? "model" : "svg",
  source: `test://${id}`,
});

const resolver = new AssetResolver(defaultAssetDefinitions);
const q = (semanticType: string, state?: string) =>
  ({ category: "entity", semanticType, state, representation: "2d" }) as const;

describe("FASE 5 — AssetResolver", () => {
  it("26.1 resuelve un asset existente", () => {
    assert.equal(
      resolver.resolve(q("pallet", "normal"))?.assetId,
      "pallet-normal-2d",
    );
  });
  it("26.2 resuelve por estado", () => {
    assert.equal(
      resolver.resolve(q("pallet", "damaged"))?.assetId,
      "pallet-damaged-2d",
    );
  });
  it("26.3 representaciones 2d y 3d independientes", () => {
    const r = new AssetResolver([
      def("p-2d", "pallet", "normal"),
      def("p-3d", "pallet", "normal", "3d"),
    ]);
    assert.equal(r.resolve(q("pallet", "normal"))?.assetId, "p-2d");
    assert.equal(
      r.resolve({ ...q("pallet", "normal"), representation: "3d" })?.assetId,
      "p-3d",
    );
    assert.equal(
      r.resolve({ ...q("pallet", "normal"), representation: "2.5d" }),
      null,
    );
  });
  it("26.4 fallback: estado desconocido cae a normal; tipo desconocido devuelve null", () => {
    assert.equal(
      resolver.resolve(q("pallet", "burning"))?.assetId,
      "pallet-normal-2d",
    );
    assert.equal(resolver.resolve(q("unknown_machine", "damaged")), null);
  });
  it("26.5 es determinista", () => {
    assert.deepEqual(
      resolver.resolve(q("machine", "broken")),
      resolver.resolve(q("machine", "broken")),
    );
  });
  it("26.7 todas las definiciones del registry se resuelven a sí mismas", () => {
    for (const d of defaultAssetDefinitions) {
      const r = resolver.resolve({
        category: d.category,
        semanticType: d.semanticType,
        state: d.state,
        representation: d.representation,
      });
      assert.equal(r?.assetId, d.id);
      assert.equal(r?.source, d.source);
    }
  });
  it("rechaza definiciones duplicadas", () => {
    assert.throws(
      () =>
        new AssetResolver([def("a", "x", "normal"), def("b", "x", "normal")]),
      /duplicada/,
    );
  });
  it("soporta roles y áreas (extensibilidad)", () => {
    assert.equal(
      resolver.resolve({
        category: "role",
        semanticType: "role-director",
        representation: "2d",
      })?.assetId,
      "role-director-normal-2d",
    );
    const r = new AssetResolver([
      def("wh", "warehouse", "normal", "2d", "area"),
    ]);
    assert.equal(
      r.resolve({
        category: "area",
        semanticType: "warehouse",
        representation: "2d",
      })?.assetId,
      "wh",
    );
  });
});

describe("FASE 5 — resolveWorldAssets", () => {
  const world = WorldSchema.parse({
    id: "w",
    metadata: { name: "T", createdAt: "x", updatedAt: "x" },
    environment: { id: "e", type: "industrial_factory", name: "F" },
    areas: [{ id: "a1", type: "warehouse", name: "Depósito" }],
    entities: [
      {
        id: "p1",
        type: "pallet",
        name: "P1",
        areaId: "a1",
        state: { condition: "damaged" },
      },
      { id: "u1", type: "unknown_machine", name: "U1", areaId: "a1" },
    ],
    roleDefinitions: [
      { id: "role-director", name: "Director" },
      { id: "role-x", name: "X" },
    ],
    roleInstances: [
      { id: "d", roleDefinitionId: "role-director", name: "D", areaId: "a1" },
      { id: "x", roleDefinitionId: "role-x", name: "X", areaId: "a1" },
    ],
  });

  it("resuelve entidades y roles; lo que no tiene asset queda fuera", () => {
    const res = resolveWorldAssets(world, resolver);
    assert.equal(res.entities.get("p1")?.assetId, "pallet-damaged-2d");
    assert.equal(res.entities.has("u1"), false);
    assert.equal(res.roles.get("d")?.assetId, "role-director-normal-2d");
    assert.equal(res.roles.has("x"), false);
  });
  it("26.6 no modifica el World", () => {
    const before = JSON.stringify(world);
    resolveWorldAssets(world, resolver);
    assert.equal(JSON.stringify(world), before);
  });
});

describe("FASE 5 — fronteras arquitectónicas", () => {
  const listTs = (dir: string) =>
    (readdirSync(join(process.cwd(), dir), { recursive: true }) as string[])
      .filter((f) => f.endsWith(".ts") && !f.includes("__tests__"))
      .map((f) => join(process.cwd(), dir, f));
  const importsAssets = /from\s+["'][^"']*assets[^"']*["']/;

  it("domain y LayoutEngine no importan el módulo de assets", () => {
    for (const file of [...listTs("src/domain"), ...listTs("src/engine")]) {
      assert.ok(!importsAssets.test(readFileSync(file, "utf8")), file);
    }
  });
  it("PixiWorldRenderer no contiene catálogo ni resolver", () => {
    const src = readFileSync(
      join(process.cwd(), "src/renderers/pixi/PixiWorldRenderer.ts"),
      "utf8",
    );
    assert.ok(!/registry|AssetResolver|case "pallet"/.test(src));
    assert.ok(/ResolvedWorldAssets/.test(src));
  });
});
