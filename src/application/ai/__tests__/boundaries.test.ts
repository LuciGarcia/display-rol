import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const listSrc = (dir: string): string[] => {
  const root = join(process.cwd(), dir);
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
    .map((f) => join(root, f));
};
const read = (file: string) => readFileSync(file, "utf8");
const importsMatching = (src: string, pattern: string) =>
  new RegExp(`from\\s+["'][^"']*${pattern}[^"']*["']`).test(src);

const SDK = /from\s+["'](@google\/generative-ai|@ai-sdk\/[^"']+|openai|ai)["']/;

describe("FASE 7 — fronteras arquitectónicas", () => {
  it("la capa application/ai no importa SDKs, el motor, ni layout, assets, renderers, hooks o componentes", () => {
    for (const file of listSrc("src/application")) {
      const src = read(file);
      assert.ok(!SDK.test(src), `SDK de IA en ${file}`);
      for (const forbidden of [
        "engine",
        "assets",
        "renderers",
        "hooks",
        "components",
      ]) {
        assert.ok(
          !importsMatching(src, `\\b${forbidden}\\b`),
          `${file} importa ${forbidden}`,
        );
      }
    }
  });
  it("domain, engine, assets, renderers y adapters no conocen la capa de IA", () => {
    for (const dir of [
      "src/domain",
      "src/engine",
      "src/assets",
      "src/renderers",
      "src/adapters",
    ]) {
      for (const file of listSrc(dir)) {
        assert.ok(
          !importsMatching(read(file), "application\\/ai"),
          `${file} importa application/ai`,
        );
      }
    }
  });
  it("solo la ruta API crea el proveedor concreto", () => {
    const allowed = [
      join("src", "ai", "createAIProvider.ts"),
      join("src", "app", "api", "ai", "interpret", "route.ts"),
    ];
    for (const file of listSrc("src")) {
      if (!read(file).includes("createAIProvider")) continue;
      assert.ok(
        allowed.some((a) => file.endsWith(sep + a) || file.endsWith(a)),
        `${file} usa createAIProvider`,
      );
    }
  });
});
