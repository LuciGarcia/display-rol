import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { World } from "../../../domain/world/world";
import { WorldEngine } from "../../../engine/world/worldEngine";
import { simulateCommands } from "../../../engine/world/simulateCommands";
import { RoleInstanceNotFoundError } from "../../../engine/world/errors";
import { InMemoryWorldRepository } from "../../../infrastructure/persistence/InMemoryWorldRepository";
import { makeWorld } from "../../ai/__tests__/fixtures";
import {
  InvalidPersistedWorldError,
  PersistenceError,
  STORAGE_UNAVAILABLE_MESSAGE,
  WorldNotFoundError,
} from "../errors";
import { WorldAutosave } from "../WorldAutosave";
import { WorldLifecycleService } from "../WorldLifecycleService";
import type { WorldRepository } from "../WorldRepository";
import { describeWorldRepositoryContract } from "./worldRepositoryContract";

const OLD = "2000-01-01T00:00:00.000Z";
const withDates = (id: string, updatedAt: string): World => {
  const w = makeWorld();
  return { ...w, id, metadata: { ...w.metadata, updatedAt } };
};
const lightsOff = (world: World): World => ({
  ...world,
  state: { ...world.state, luces: "off" },
});
const moveDirector = {
  type: "MOVE_ROLE",
  roleInstanceId: "director-general",
  targetAreaId: "warehouse",
};

// 1. El contrato que deberá cumplir también el adaptador durable
describeWorldRepositoryContract("InMemoryWorldRepository", () => {
  const storage = new Map<string, string>();
  return {
    open: () => new InMemoryWorldRepository(storage),
    plantRaw: (id, raw) => void storage.set(id, raw),
  };
});

describe("FASE 11 — updatedAt es estado del dominio y lo mantiene el WorldEngine", () => {
  it("un comando aplicado fija metadata.updatedAt al instante del evento", () => {
    const engine = new WorldEngine(withDates("w1", OLD));
    const event = engine.executeCommand(moveDirector);
    assert.equal(engine.getWorld().metadata.updatedAt, event.timestamp);
    assert.notEqual(event.timestamp, OLD);
  });

  it("un comando rechazado no modifica el World ni su updatedAt", () => {
    const engine = new WorldEngine(withDates("w1", OLD));
    const before = engine.serialize();
    assert.throws(
      () =>
        engine.executeCommand({ ...moveDirector, roleInstanceId: "no-existe" }),
      (e: unknown) => e instanceof RoleInstanceNotFoundError,
    );
    assert.equal(engine.serialize(), before);
  });

  it("simulateCommands no toca el World original (su updatedAt queda igual)", () => {
    const world = withDates("w1", OLD);
    const sim = simulateCommands(world, [
      {
        type: "MOVE_ROLE",
        roleInstanceId: "director-general",
        targetAreaId: "warehouse",
      },
    ]);
    assert.ok(sim.ok);
    assert.equal(world.metadata.updatedAt, OLD);
    if (sim.ok) assert.notEqual(sim.world.metadata.updatedAt, OLD);
  });

  it("modificar y guardar una partida la ubica primera en la lista de partidas", async () => {
    const service = new WorldLifecycleService(new InMemoryWorldRepository());
    const stale = withDates("a", OLD);
    const newer = withDates("b", "2000-01-02T00:00:00.000Z");
    await service.persist(stale);
    await service.persist(newer);
    assert.deepEqual(
      (await service.list()).map((s) => s.id),
      ["b", "a"],
    );

    const engine = new WorldEngine(stale);
    engine.executeCommand(moveDirector);
    await service.persist(engine.getWorld());
    assert.deepEqual(
      (await service.list()).map((s) => s.id),
      ["a", "b"],
    );
  });
});

describe("FASE 11 — la frontera de errores no filtra detalles del almacenamiento", () => {
  const secret =
    "connect ECONNREFUSED postgres://admin:s3cr3t@db.internal:5432/juego";
  const driverFailure = new Error(secret);
  const broken: WorldRepository = {
    create: async () => {
      throw driverFailure;
    },
    getById: async () => {
      throw driverFailure;
    },
    save: async () => {
      throw driverFailure;
    },
    delete: async () => {
      throw driverFailure;
    },
    list: async () => {
      throw driverFailure;
    },
  };
  const service = new WorldLifecycleService(broken);

  it("cada operación falla con PersistenceError genérico y conserva la causa", async () => {
    const ops: Array<() => Promise<unknown>> = [
      () => service.persist(makeWorld()),
      () => service.load("x"),
      () => service.list(),
      () => service.remove("x"),
    ];
    for (const op of ops) {
      await assert.rejects(op, (e: unknown) => {
        assert.ok(e instanceof PersistenceError);
        assert.equal(e.message, STORAGE_UNAVAILABLE_MESSAGE);
        assert.ok(!/s3cr3t|postgres|5432/.test(e.message));
        assert.equal(e.cause, driverFailure);
        return true;
      });
    }
  });

  it("los errores de aplicación esperables pasan sin traducirse", async () => {
    const svc = new WorldLifecycleService(new InMemoryWorldRepository());
    await assert.rejects(
      () => svc.load("nope"),
      (e: unknown) => e instanceof WorldNotFoundError,
    );
    await assert.rejects(
      () => svc.remove("nope"),
      (e: unknown) => e instanceof WorldNotFoundError,
    );
  });

  it("un fallo genérico al guardar no se interpreta como 'no existe' ni intenta crear", async () => {
    let created = false;
    const repo: WorldRepository = {
      ...broken,
      create: async () => {
        created = true;
      },
    };
    await assert.rejects(() =>
      new WorldLifecycleService(repo).persist(makeWorld()),
    );
    assert.equal(created, false);
  });

  it("un World persistido inválido sigue siendo InvalidPersistedWorldError", async () => {
    const storage = new Map([["roto", "no es json"]]);
    const svc = new WorldLifecycleService(new InMemoryWorldRepository(storage));
    await assert.rejects(
      () => svc.load("roto"),
      (e: unknown) => e instanceof InvalidPersistedWorldError,
    );
  });
});

describe("FASE 11 — WorldAutosave: cuándo se persiste", () => {
  function spied() {
    const inner = new InMemoryWorldRepository();
    const writes: string[] = [];
    const repo: WorldRepository = {
      create: async (w) => {
        writes.push("create");
        await inner.create(w);
      },
      getById: (id) => inner.getById(id),
      save: async (w) => {
        writes.push("save");
        await inner.save(w);
      },
      delete: (id) => inner.delete(id),
      list: () => inner.list(),
    };
    return {
      inner,
      writes,
      autosave: new WorldAutosave(new WorldLifecycleService(repo)),
    };
  }

  it("un World creado se guarda (create) y los cambios siguientes se actualizan (save)", async () => {
    const { writes, autosave } = spied();
    const world = makeWorld();
    assert.equal(await autosave.notify(world), "saved");
    assert.equal(await autosave.notify(lightsOff(world)), "saved");
    assert.deepEqual(writes, ["save", "create", "save"]); // save falla (no existe) → create
  });

  it("cargar una partida no produce ninguna escritura", async () => {
    const { inner, writes, autosave } = spied();
    await inner.create(makeWorld());
    const loaded = await inner.getById("w1");

    autosave.markLoaded(loaded);
    assert.equal(await autosave.notify(loaded), "skipped");
    assert.deepEqual(writes, []);
  });

  it("después de cargar, el primer cambio real sí se guarda", async () => {
    const { inner, writes, autosave } = spied();
    await inner.create(makeWorld());
    const loaded = await inner.getById("w1");

    autosave.markLoaded(loaded);
    await autosave.notify(loaded); // snapshot de la carga: se omite
    const engine = new WorldEngine(loaded);
    engine.executeCommand(moveDirector);
    assert.equal(await autosave.notify(engine.getWorld()), "saved");
    assert.deepEqual(writes, ["save"]);
    assert.equal(
      (await inner.getById("w1")).roleInstances[0].areaId,
      "warehouse",
    );
  });

  it("la omisión es de un solo uso", async () => {
    const { inner, writes, autosave } = spied();
    await inner.create(makeWorld());
    const loaded = await inner.getById("w1");
    autosave.markLoaded(loaded);
    await autosave.notify(loaded);
    assert.equal(await autosave.notify(loaded), "saved");
    assert.deepEqual(writes, ["save"]);
  });

  it("un World distinto del cargado nunca se omite", async () => {
    const { inner, autosave } = spied();
    await inner.create(makeWorld());
    autosave.markLoaded(await inner.getById("w1"));
    assert.equal(await autosave.notify(withDates("otro", OLD)), "saved");
  });

  it("los guardados se aplican en el orden de los snapshots aunque el primero tarde", async () => {
    const inner = new InMemoryWorldRepository();
    const first = makeWorld();
    await inner.create(first);

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const order: unknown[] = [];
    let calls = 0;
    const slow: WorldRepository = {
      create: (w) => inner.create(w),
      getById: (id) => inner.getById(id),
      delete: (id) => inner.delete(id),
      list: () => inner.list(),
      save: async (w) => {
        if (calls++ === 0) await gate; // el primer guardado queda pendiente
        order.push(w.state.luces ?? "inicial");
        await inner.save(w);
      },
    };
    const autosave = new WorldAutosave(new WorldLifecycleService(slow));

    const p1 = autosave.notify(first);
    const p2 = autosave.notify(lightsOff(first));
    release();
    await Promise.all([p1, p2]);

    assert.deepEqual(order, ["inicial", "off"]);
    assert.equal((await inner.getById("w1")).state.luces, "off");
  });

  it("un guardado fallido rechaza solo su notificación y la cola sigue funcionando", async () => {
    const inner = new InMemoryWorldRepository();
    await inner.create(makeWorld());
    let fail = true;
    const flaky: WorldRepository = {
      create: (w) => inner.create(w),
      getById: (id) => inner.getById(id),
      delete: (id) => inner.delete(id),
      list: () => inner.list(),
      save: async (w) => {
        if (fail) {
          fail = false;
          throw new PersistenceError("disco lleno");
        }
        await inner.save(w);
      },
    };
    const autosave = new WorldAutosave(new WorldLifecycleService(flaky));
    await assert.rejects(
      () => autosave.notify(makeWorld()),
      (e: unknown) => e instanceof PersistenceError,
    );
    assert.equal(await autosave.notify(lightsOff(makeWorld())), "saved");
    assert.equal((await inner.getById("w1")).state.luces, "off");
  });
});

describe("FASE 11 — independencia del dominio respecto del almacenamiento", () => {
  const read = (dir: string) =>
    (readdirSync(join(process.cwd(), dir), { recursive: true }) as string[])
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
      .map((f) => ({
        file: join(dir, f).replaceAll("\\", "/"),
        text: readFileSync(join(process.cwd(), dir, f), "utf8"),
      }));

  it("domain, engine, IA, assets y renderers no mencionan ningún ORM, driver ni DATABASE_URL", () => {
    const storage =
      /@prisma|\bprisma\b|postgres|drizzle|typeorm|DATABASE_URL|from\s+["']pg["']/i;
    for (const dir of [
      "src/domain",
      "src/engine",
      "src/application/ai",
      "src/assets",
      "src/renderers",
    ]) {
      for (const f of read(dir)) {
        assert.ok(!storage.test(f.text), `${f.file} conoce el almacenamiento`);
      }
    }
  });

  it("ningún adaptador concreto se importa fuera de las raíces de composición y las rutas API", () => {
    const allowed = [
      "src/app/lib/worldLifecycle.ts",
      "src/app/lib/serverWorldRepository.ts",
    ];
    const offenders = read("src")
      .filter((f) => /infrastructure\/persistence/.test(f.text))
      .map((f) => f.file)
      .filter((f) => !allowed.includes(f) && !f.startsWith("src/app/api/"));
    assert.deepEqual(offenders, []);
  });
  it("el hook de ciclo de vida delega el cuándo guardar en WorldAutosave y no escribe por su cuenta", () => {
    const hook = read("src/hooks").find((f) =>
      f.file.endsWith("useWorldLifecycle.ts"),
    );
    assert.ok(hook);
    assert.ok(hook.text.includes("WorldAutosave"));
    assert.ok(!/\.persist\(|\.save\(|\.create\(/.test(hook.text));
  });

  it("los handlers de acción del Master no persisten", () => {
    const game = read("src/hooks").find((f) =>
      f.file.endsWith("useMasterGame.ts"),
    );
    assert.ok(game);
    assert.ok(!/persist\(|\.save\(|repository/i.test(game.text));
  });
});
