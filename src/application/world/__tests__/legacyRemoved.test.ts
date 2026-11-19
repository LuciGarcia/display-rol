import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guarda única: el código legacy eliminado no debe reaparecer ni ser referenciado.
const root = process.cwd();
const sources = (readdirSync(join(root, "src"), { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
  .map((f) => ({ file: f, text: readFileSync(join(root, "src", f), "utf8") }));

const REMOVED_FILES = [
  "src/app/api/generate-map/route.ts",
  "src/adapters/legacyToWorld.ts",
  "src/app/lib/prompts.ts",
  "src/app/lib/areaLayout.ts",
  "src/app/lib/furniturePacker.ts",
  "src/app/lib/layoutPacker.ts",
  "src/app/lib/assetsCatalog.ts",
  "src/types/schema.ts",
  "src/components/FloorMap.tsx",
  "src/components/ObstacleShape.tsx",
  "src/components/IndustrialAssets.tsx",
];

const LEGACY_REFERENCES =
  /generate-map|legacyToWorld|types\/schema|konva|\b(MapData|FloorMap|CharacterData|BoundsSchema|ObstacleSchema|CharacterSchema|MapSchema|PlacedObstacle)\b/i;

describe("el código legacy no reaparece", () => {
  it("los módulos eliminados no existen", () => {
    for (const gone of REMOVED_FILES) {
      assert.ok(!existsSync(join(root, gone)), `${gone} no debería existir`);
    }
  });

  it("ningún código referencia los modelos o endpoints legacy", () => {
    for (const { file, text } of sources) {
      assert.ok(!LEGACY_REFERENCES.test(text), `${file} referencia código legacy`);
    }
  });

  it("Konva no es dependencia", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    assert.deepEqual(deps.filter((d) => /konva/i.test(d)), []);
  });
});
