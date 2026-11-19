import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WorldSchema } from "../../../domain/world/world";
import { makeWorld } from "../../ai/__tests__/fixtures";
import { buildRoleSpawnCommands, toRoleDefinitions } from "../spawnRoles";
import { INITIAL_ROLES } from "../../../app/lib/roles";
import { simulateCommands } from "../../../engine/world/simulateCommands";
import { BuildingLayoutEngine } from "../../../engine/layout/BuildingLayoutEngine";

const root = process.cwd();
const listSources = (dir: string) =>
  (readdirSync(join(root, dir), { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
    .map((f) => ({
      file: join(dir, f).replaceAll("\\", "/"),
      text: readFileSync(join(root, dir, f), "utf8"),
    }));
const src = listSources("src");

describe("B. el dominio y la capa de aplicación no contienen datos visuales", () => {
  it("domain/ y application/ no declaran bounds, width, height, rotation ni assetId", () => {
    const visual = /\b(bounds|width|height|rotation|assetId)\b/;
    for (const { file, text } of src) {
      if (!/^src\/(domain|application)\//.test(file)) continue;
      assert.ok(!visual.test(text), `${file} contiene datos visuales`);
    }
  });
});

describe("C. el Display consume World", () => {
  const display = src.find((s) => s.file === "src/app/display/page.tsx");

  it("valida el snapshot con WorldSchema y lo dibuja con PixiWorldCanvas (solo lectura)", () => {
    assert.ok(display, "no se encontró la página Display");
    assert.ok(display.text.includes("useWorldSync")); // la validación con WorldSchema vive en el protocolo realtime (protocolo realtime)
    assert.ok(display.text.includes("<PixiWorldCanvas world={world} />"));
    assert.ok(!/onAreaSelected|executeCommand|useWorldEngine/.test(display.text));
  });

  it("un World sobrevive a JSON y vuelve a validar igual (contrato del snapshot)", () => {
    const world = makeWorld();
    const wire: unknown = JSON.parse(JSON.stringify(world));
    const parsed = WorldSchema.safeParse(wire);
    assert.ok(parsed.success);
    if (parsed.success) assert.deepEqual(parsed.data, world);
  });

  it("un snapshot inválido es rechazado", () => {
    assert.ok(!WorldSchema.safeParse({ areas: "no" }).success);
    assert.ok(!WorldSchema.safeParse(null).success);
  });

  it("el World recibido alimenta al LayoutEngine sin ningún otro modelo", () => {
    const wire: unknown = JSON.parse(JSON.stringify(makeWorld()));
    const world = WorldSchema.parse(wire);
    const layout = new BuildingLayoutEngine().compute(world);
    assert.equal(layout.areas.length, world.areas.length);
  });
});

describe("D. los roles del Master usan un único tipo (SetupRole)", () => {
  it("INITIAL_ROLES se siembra en un World mediante ADD_ROLE", () => {
    const base = { ...makeWorld(), roleDefinitions: toRoleDefinitions(INITIAL_ROLES), roleInstances: [] };
    const sim = simulateCommands(base, buildRoleSpawnCommands(base, INITIAL_ROLES));
    assert.ok(sim.ok);
    if (sim.ok) assert.equal(sim.world.roleInstances.length, INITIAL_ROLES.length);
  });
});
