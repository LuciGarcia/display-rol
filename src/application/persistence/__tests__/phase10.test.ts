import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WorldSchema } from "../../../domain/world/world";
import { WorldEngine } from "../../../engine/world/worldEngine";
import { createEmptyWorld } from "../../ai/compileOperations";
import { makeWorld } from "../../ai/__tests__/fixtures";
import { InMemoryWorldRepository } from "../../../infrastructure/persistence/InMemoryWorldRepository";
import {
  InvalidPersistedWorldError,
  PersistenceError,
  WorldAlreadyExistsError,
  WorldNotFoundError,
} from "../errors";
import {
  PERSISTENCE_FORMAT_VERSION,
  deserializeWorld,
  serializeWorld,
} from "../serialization";
import { WorldLifecycleService } from "../WorldLifecycleService";
import type { WorldRepository } from "../WorldRepository";

const is =
  <T extends Error>(cls: new (...args: never[]) => T) =>
  (e: unknown) =>
    e instanceof cls;

describe("FASE 10 — 1. crear y recuperar", () => {
  it("create → getById devuelve un World equivalente", async () => {
    const repo = new InMemoryWorldRepository();
    const world = makeWorld();
    await repo.create(world);
    assert.deepEqual(await repo.getById(world.id), world);
  });

  it("lo recuperado no comparte referencias con el original ni con otras lecturas", async () => {
    const repo = new InMemoryWorldRepository();
    const world = makeWorld();
    await repo.create(world);
    const a = await repo.getById(world.id);
    a.areas[0].name = "MUTADO";
    world.areas[1].name = "MUTADO";
    const b = await repo.getById(world.id);
    assert.equal(b.areas[0].name, "Oficina");
    assert.equal(b.areas[1].name, "Planta de producción");
  });

  it("crear un id existente falla; pedir un id inexistente falla", async () => {
    const repo = new InMemoryWorldRepository();
    await repo.create(makeWorld());
    await assert.rejects(() => repo.create(makeWorld()), is(WorldAlreadyExistsError));
    await assert.rejects(() => repo.getById("nope"), is(WorldNotFoundError));
  });
});

describe("FASE 10 — 2. serialización JSON", () => {
  it("World → serialize → deserialize sigue siendo válido con WorldSchema", () => {
    const world = makeWorld();
    const raw = serializeWorld(world);
    const back = deserializeWorld(raw);
    assert.ok(WorldSchema.safeParse(back).success);
    assert.deepEqual(back, world);
  });

  it("el formato guardado lleva su versión de almacenamiento", () => {
    const parsed = JSON.parse(serializeWorld(makeWorld()));
    assert.equal(parsed.format, PERSISTENCE_FORMAT_VERSION);
    assert.equal(parsed.world.id, "w1");
  });

  it("no se serializa un World inválido", () => {
    const broken = { ...makeWorld(), areas: "no" } as never;
    assert.throws(() => serializeWorld(broken), is(InvalidPersistedWorldError));
  });
});

describe("FASE 10 — 3. actualización", () => {
  it("guardar A, modificarlo con comandos, guardar B y recuperar B", async () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldEngine(makeWorld());
    const a = engine.getWorld();
    await repo.create(a);

    engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "director-general",
      targetAreaId: "production-floor",
    });
    const b = engine.getWorld();
    await repo.save(b);

    const stored = await repo.getById(a.id);
    assert.equal(stored.roleInstances[0].areaId, "production-floor");
    assert.notEqual(a.roleInstances[0].areaId, stored.roleInstances[0].areaId);
  });

  it("guardar un World que no fue creado falla", async () => {
    await assert.rejects(
      () => new InMemoryWorldRepository().save(makeWorld()),
      is(WorldNotFoundError),
    );
  });
});

describe("FASE 10 — 4. eliminación", () => {
  it("crear → eliminar → recuperar produce 'no encontrado'", async () => {
    const repo = new InMemoryWorldRepository();
    await repo.create(makeWorld());
    await repo.delete("w1");
    await assert.rejects(() => repo.getById("w1"), is(WorldNotFoundError));
    await assert.rejects(() => repo.delete("w1"), is(WorldNotFoundError));
  });
});

describe("FASE 10 — 5. datos persistidos inválidos", () => {
  const world = makeWorld();
  const repo = new InMemoryWorldRepository(
    new Map(Object.entries({
    "no-json": "esto no es json",
    "sin-formato": JSON.stringify(world),
    "formato-futuro": JSON.stringify({ format: 99, world }),
    "world-roto": JSON.stringify({
      format: PERSISTENCE_FORMAT_VERSION,
      world: { ...world, areas: "no" },
    }),
    "world-vacio": JSON.stringify({ format: PERSISTENCE_FORMAT_VERSION }),
  })),
  );

  it("cada variante corrupta se rechaza con InvalidPersistedWorldError y nunca como World", async () => {
    for (const id of [
      "no-json",
      "sin-formato",
      "formato-futuro",
      "world-roto",
      "world-vacio",
    ]) {
      await assert.rejects(() => repo.getById(id), is(InvalidPersistedWorldError), id);
    }
  });

  it("list ignora las entradas corruptas y devuelve las válidas", async () => {
    await repo.create(world);
    const list = await repo.list();
    assert.deepEqual(
      list.map((s) => s.id),
      ["w1"],
    );
  });
});

describe("FASE 10 — 6. el repositorio persiste World y nada más", () => {
  const read = (dir: string) =>
    (readdirSync(join(process.cwd(), dir), { recursive: true }) as string[])
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
      .map((f) => ({
        file: join(dir, f).replaceAll("\\", "/"),
        text: readFileSync(join(process.cwd(), dir, f), "utf8"),
      }));

  it("la persistencia no menciona modelos legacy ni datos visuales", () => {
    const forbidden =
      /\b(MapData|CharacterData|MapSchema|bounds|width|height|rotation|assetId)\b/;
    for (const f of [
      ...read("src/application/persistence"),
      ...read("src/infrastructure"),
    ]) {
      assert.ok(!forbidden.test(f.text), `${f.file} menciona modelos legacy/visuales`);
    }
  });

  it("la unidad persistida se valida con WorldSchema (no hay repositorios por partes)", () => {
    const names = read("src/application/persistence").map((f) => f.file);
    assert.ok(!names.some((n) => /Area|Entity|Role.*Repository/.test(n)));
    const serialization = read("src/application/persistence").find((f) =>
      f.file.endsWith("serialization.ts"),
    );
    assert.ok(serialization?.text.includes("WorldSchema.safeParse"));
  });

  it("el dominio, el engine, la IA, los assets y los renderers no conocen la persistencia", () => {
    for (const dir of [
      "src/domain",
      "src/engine",
      "src/ai",
      "src/assets",
      "src/renderers",
      "src/adapters",
      "src/application/ai",
    ]) {
      for (const f of read(dir)) {
        assert.ok(
          !/application\/persistence|infrastructure|WorldRepository/.test(f.text),
          `${f.file} conoce la persistencia`,
        );
      }
    }
  });

  it("la capa de persistencia no depende de React, Next, bases de datos ni del filesystem", () => {
    const infra =
      /from\s+["'](react|next[^"']*|@prisma\/client|pg|node:fs[^"']*|fs)["']|localStorage|indexedDB/;
    for (const f of [
      ...read("src/application/persistence"),
      ...read("src/infrastructure"),
    ]) {
      assert.ok(!infra.test(f.text), `${f.file} depende de infraestructura concreta`);
    }
  });
});

describe("FASE 10 — ciclo de vida de la partida", () => {
  it("persist crea la primera vez y actualiza las siguientes", async () => {
    const repo = new InMemoryWorldRepository();
    const service = new WorldLifecycleService(repo);
    const engine = new WorldEngine(makeWorld());

    await service.persist(engine.getWorld());
    assert.equal((await service.list()).length, 1);

    engine.executeCommand({
      type: "SET_STATE",
      targetType: "AREA",
      targetId: "warehouse",
      key: "lighting",
      value: "off",
    });
    await service.persist(engine.getWorld());

    const loaded = await service.load("w1");
    assert.equal(loaded.areas.find((a) => a.id === "warehouse")?.state.lighting, "off");
    assert.equal((await service.list()).length, 1);
  });

  it("una partida guardada se carga en un WorldEngine y se puede seguir trabajando", async () => {
    const service = new WorldLifecycleService(new InMemoryWorldRepository());
    await service.persist(makeWorld());
    const engine = new WorldEngine(await service.load("w1"));
    const event = engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "director-general",
      targetAreaId: "warehouse",
    });
    assert.equal(event.type, "ROLE_MOVED");
  });

  it("los errores de persistencia distintos de 'no existe' no se disfrazan de creación", async () => {
    let created = false;
    const failing: WorldRepository = {
      create: async () => {
        created = true;
      },
      getById: async () => makeWorld(),
      save: async () => {
        throw new PersistenceError("disco lleno");
      },
      delete: async () => {},
      list: async () => [],
    };
    await assert.rejects(
      () => new WorldLifecycleService(failing).persist(makeWorld()),
      is(PersistenceError),
    );
    assert.equal(created, false);
  });

  it("remove elimina la partida y list refleja el cambio", async () => {
    const service = new WorldLifecycleService(new InMemoryWorldRepository());
    await service.persist(makeWorld());
    await service.remove("w1");
    assert.deepEqual(await service.list(), []);
  });

  it("dos partidas generadas con el mismo nombre no se pisan al guardarse", async () => {
    const header = { name: "Hospital Central", environmentType: "hospital" as const };
    const first = createEmptyWorld(header, new Date("2026-01-01T10:00:00Z"));
    const second = createEmptyWorld(header, new Date("2026-01-01T10:00:05Z"));
    assert.notEqual(first.id, second.id);

    const service = new WorldLifecycleService(new InMemoryWorldRepository());
    await service.persist(first);
    await service.persist(second);
    assert.equal((await service.list()).length, 2);
  });
});
