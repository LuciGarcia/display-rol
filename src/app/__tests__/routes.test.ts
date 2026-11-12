import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src/app");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const rel = (f: string) => f.slice(root.length + 1).replaceAll("\\", "/");

describe("rutas de la aplicación", () => {
  it("las únicas pantallas son /master y /display (y / solo redirige al Master)", () => {
    const pages = walk(root)
      .filter((f) => /\/page\.tsx$/.test(f.replaceAll("\\", "/")))
      .map(rel)
      .sort();
    assert.deepEqual(pages, [
      "display/page.tsx",
      "master/page.tsx",
      "page.tsx",
    ]);
    const home = readFileSync(join(root, "page.tsx"), "utf8");
    assert.match(home, /redirect\(\s*["']\/master["']\s*\)/);
  });

  it("el Display no tiene parámetros de URL: muestra la partida activa", () => {
    const display = readFileSync(join(root, "display/page.tsx"), "utf8");
    assert.ok(display.includes("useActiveWorldId"));
    assert.ok(!/useParams|searchParams|params:/.test(display));
  });

  it("ningún archivo enlaza a rutas retiradas", () => {
    const offenders = walk(join(process.cwd(), "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
      .filter((f) =>
        /pixi-demo|dev\/world|\/display\/\$\{/.test(readFileSync(f, "utf8")),
      );
    assert.deepEqual(offenders, []);
  });

  it("el Master y el Display no dependen entre sí", () => {
    assert.ok(
      !readFileSync(join(root, "master/page.tsx"), "utf8").includes(
        "app/display",
      ),
    );
    assert.ok(
      !readFileSync(join(root, "display/page.tsx"), "utf8").includes(
        "app/master",
      ),
    );
  });
});
