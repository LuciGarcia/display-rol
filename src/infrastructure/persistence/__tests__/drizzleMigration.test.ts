import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { makeWorld } from "../../../application/ai/__tests__/fixtures";
import {
  InvalidPersistedWorldError,
  PersistenceError,
  STORAGE_UNAVAILABLE_MESSAGE,
} from "../../../application/persistence/errors";
import type { WorldRepository } from "../../../application/persistence/WorldRepository";
import { DrizzleWorldRepository } from "../DrizzleWorldRepository";
import { games } from "../drizzle/schema";

const root = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "__tests__"]);

function filesUnder(dir: string): { file: string; text: string }[] {
  const base = join(root, dir);
  if (!existsSync(base)) return [];
  const out: { file: string; text: string }[] = [];
  const walk = (current: string, relative: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const path = join(current, entry.name);
      const rel = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(path, rel);
      else if (/\.(ts|tsx|json|md|mjs|cjs|js)$/.test(entry.name))
        out.push({ file: rel, text: readFileSync(path, "utf8") });
    }
  };
  walk(base, dir);
  return out;
}
const rootFile = (name: string) =>
  existsSync(join(root, name)) ? readFileSync(join(root, name), "utf8") : "";
const src = filesUnder("src");

describe("FASE 11.1 — Prisma eliminado", () => {
  it("no existen archivos ni carpetas de Prisma", () => {
    for (const p of ["prisma", "prisma.config.ts", "schema.prisma"]) {
      assert.ok(!existsSync(join(root, p)), `${p} no debería existir`);
    }
  });

  it("package.json no menciona Prisma", () => {
    assert.ok(!/prisma/i.test(rootFile("package.json")));
  });

  it("el lockfile no instala ningún paquete de Prisma (solo el peer opcional de drizzle-orm)", () => {
    const lock = JSON.parse(rootFile("package-lock.json")) as {
      packages: Record<string, unknown>;
    };
    const installed = Object.keys(lock.packages).filter((p) =>
      /node_modules\/(@prisma|\.prisma|prisma)(\/|$)/.test(p),
    );
    assert.deepEqual(installed, []);
  });

  it("código, scripts, documentación y configuración no mencionan Prisma", () => {
    const targets = [
      ...src,
      ...filesUnder("scripts"),
      { file: "README.md", text: rootFile("README.md") },
      { file: ".env.example", text: rootFile(".env.example") },
      { file: "drizzle.config.ts", text: rootFile("drizzle.config.ts") },
    ];
    for (const { file, text } of targets)
      assert.ok(!/prisma/i.test(text), `${file} menciona Prisma`);
  });
});

describe("FASE 11.1 — Drizzle queda aislado en infraestructura", () => {
  const importsOrm =
    /from\s+["'](drizzle-orm[^"']*|drizzle-kit|postgres)["']|drizzle\.config/;

  it("dominio, aplicación, engine, IA, assets, renderers, hooks y componentes no conocen Drizzle ni postgres", () => {
    for (const dir of [
      "src/domain",
      "src/application",
      "src/engine",
      "src/ai",
      "src/assets",
      "src/renderers",
      "src/hooks",
      "src/components",
    ]) {
      for (const f of filesUnder(dir))
        assert.ok(
          !importsOrm.test(f.text) && !/drizzle/i.test(f.text),
          `${f.file} conoce el ORM`,
        );
    }
  });

  it("solo src/infrastructure/persistence importa el ORM o el driver", () => {
    const offenders = src
      .filter((f) => importsOrm.test(f.text))
      .map((f) => f.file)
      .filter((f) => !f.startsWith("src/infrastructure/persistence/"));
    assert.deepEqual(offenders, []);
  });

  it("existe un único punto de creación de la conexión", () => {
    const creators = src
      .filter((f) => /\bpostgres\(/.test(f.text))
      .map((f) => f.file);
    assert.deepEqual(creators, [
      "src/infrastructure/persistence/drizzle/client.ts",
    ]);
  });

  it("el navegador compone HttpWorldRepository; el repositorio Drizzle solo llega a las rutas API", () => {
    const lifecycle = src.find(
      (f) => f.file === "src/app/lib/worldLifecycle.ts",
    );
    assert.ok(
      lifecycle?.text.includes("HttpWorldRepository") &&
        !/Drizzle/.test(lifecycle.text),
    );
    const users = src
      .filter((f) => /from\s+["'][^"']*serverWorldRepository["']/.test(f.text))
      .map((f) => f.file);
    assert.ok(
      users.every(
        (f) =>
          f.startsWith("src/app/api/") ||
          f === "src/app/lib/serverWorldRepository.ts",
      ),
      users.join(", "),
    );
  });
});

describe("FASE 11.1 — DrizzleWorldRepository (sin base de datos)", () => {
  const driverFailure = () => {
    throw new Error("password authentication failed for user admin");
  };
  const failingDb = {
    insert: driverFailure,
    select: driverFailure,
    update: driverFailure,
    delete: driverFailure,
  } as never;

  it("implementa WorldRepository", () => {
    const repo: WorldRepository = new DrizzleWorldRepository({} as never);
    for (const method of [
      "create",
      "getById",
      "save",
      "delete",
      "list",
    ] as const) {
      assert.equal(typeof repo[method], "function");
    }
  });

  it("los errores del driver salen como PersistenceError genérico, con la causa conservada", async () => {
    const repo = new DrizzleWorldRepository(failingDb);
    const ops: Array<() => Promise<unknown>> = [
      () => repo.create(makeWorld()),
      () => repo.getById("w1"),
      () => repo.save(makeWorld()),
      () => repo.delete("w1"),
      () => repo.list(),
    ];
    for (const op of ops) {
      await assert.rejects(op, (e: unknown) => {
        assert.ok(e instanceof PersistenceError);
        assert.equal(e.message, STORAGE_UNAVAILABLE_MESSAGE);
        assert.ok(e.cause instanceof Error);
        return true;
      });
    }
  });

  it("un updatedAt que no es una fecha se rechaza antes de tocar la base", async () => {
    const world = makeWorld();
    const bad = { ...world, metadata: { ...world.metadata, updatedAt: "x" } };
    const repo = new DrizzleWorldRepository({} as never); // si tocara la base, fallaría con TypeError
    await assert.rejects(
      () => repo.create(bad),
      (e: unknown) => e instanceof InvalidPersistedWorldError,
    );
    await assert.rejects(
      () => repo.save(bad),
      (e: unknown) => e instanceof InvalidPersistedWorldError,
    );
  });
});

describe("FASE 11.1 — schema", () => {
  it("una sola tabla games con las columnas previstas y sin tablas de fases futuras", () => {
    const table = getTableConfig(games);
    assert.equal(table.name, "games");
    assert.deepEqual(
      table.columns.map((c) => c.name),
      ["id", "name", "world_json", "created_at", "updated_at"],
    );
    assert.ok(table.columns.find((c) => c.name === "id")?.primary);
  });
});
