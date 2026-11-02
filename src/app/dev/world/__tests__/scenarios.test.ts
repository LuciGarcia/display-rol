import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEV_SCENARIOS } from "../scenarios";
import { BuildingLayoutEngine } from "../../../../engine/layout/BuildingLayoutEngine";
import { validateLayout } from "../../../../engine/layout/validateLayout";

describe("FASE 0.1 — escenarios de /dev/world", () => {
  const engine = new BuildingLayoutEngine();

  for (const s of DEV_SCENARIOS) {
    it(`"${s.label}": World válido, layout completo y sin incidencias`, () => {
      const world = s.build();
      const layout = engine.compute(world);
      assert.equal(layout.areas.length, world.areas.length);
      assert.deepEqual(validateLayout(layout), []);
    });
  }

  it("cubre las cantidades pedidas (1, 3, 6 y ≥10 áreas), tamaños distintos, relaciones, mucho y nada de contenido", () => {
    const worlds = DEV_SCENARIOS.map((s) => s.build());
    const counts = new Set(worlds.map((w) => w.areas.length));
    for (const n of [1, 3, 6])
      assert.ok(counts.has(n), `falta escenario con ${n} áreas`);
    assert.ok([...counts].some((n) => n >= 10));
    assert.ok(worlds.some((w) => w.areas.some((a) => a.relations.length > 0)));
    assert.ok(worlds.some((w) => w.entities.length >= 60));
    assert.ok(
      worlds.some((w) => w.areas.length > 1 && w.entities.length === 0),
    );
  });

  it("los escenarios no contienen geometría (solo datos semánticos)", () => {
    for (const s of DEV_SCENARIOS) {
      const json = JSON.stringify(s.build().areas);
      assert.ok(!/"(x|y|width|height)"/.test(json));
    }
  });
});

describe("FASE 0.1 — rutas de desarrollo", () => {
  const root = join(process.cwd(), "src/app");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );

  it("/dev/world es la única ruta de demo y /pixi-demo no existe", () => {
    assert.ok(existsSync(join(root, "dev/world/page.tsx")));
    assert.ok(!existsSync(join(root, "pixi-demo")));
  });

  it("ningún archivo de src enlaza a /pixi-demo", () => {
    const offenders = walk(join(process.cwd(), "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
      .filter((f) => readFileSync(f, "utf8").includes("pixi-demo"));
    assert.deepEqual(offenders, []);
  });

  it("/dev/world no anida controles interactivos y todos son type=button", () => {
    const src = readFileSync(join(root, "dev/world/page.tsx"), "utf8");
    const opens = src.match(/<button\b/g)?.length ?? 0;
    const closes = src.match(/<\/button>/g)?.length ?? 0;
    assert.equal(opens, closes);
    assert.equal(src.match(/type="button"/g)?.length ?? 0, opens);
    // entre una apertura y su cierre no puede haber otra apertura
    for (const m of src.matchAll(/<button\b[\s\S]*?<\/button>/g)) {
      assert.equal(m[0].match(/<button\b/g)?.length, 1, "botón anidado");
      assert.ok(!/<(a|select|input)\b/.test(m[0]), "control anidado");
    }
  });

  it("el Display y el Master no dependen de /dev", () => {
    for (const f of walk(root).filter(
      (f) =>
        /^\/(display|master)\//.test(f.slice(root.length)) && /\.tsx?$/.test(f),
    )) {
      assert.ok(!readFileSync(f, "utf8").includes("/dev/world"));
    }
  });
});
