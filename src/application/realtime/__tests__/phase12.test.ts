import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { World } from "../../../domain/world/world";
import { WorldEngine } from "../../../engine/world/worldEngine";
import { simulateCommands } from "../../../engine/world/simulateCommands";
import { LayoutEngine } from "../../../engine/layout/LayoutEngine";
import { makeWorld } from "../../ai/__tests__/fixtures";
import { InMemoryWorldRepository } from "../../../infrastructure/persistence/InMemoryWorldRepository";
import { WorldLifecycleService } from "../../persistence/WorldLifecycleService";
import { WorldNotFoundError } from "../../persistence/errors";
import type { WorldRepository } from "../../persistence/WorldRepository";
import { PublishingWorldRepository } from "../PublishingWorldRepository";
import type {
  RealtimeStatus,
  WorldRealtimePublisher,
  WorldRealtimeSubscriber,
  WorldSubscriptionHandlers,
} from "../ports";
import { WorldSync } from "../WorldSync";
import {
  WORLD_UPDATED,
  buildWorldUpdated,
  isNewerWorld,
  parseWorldUpdated,
  worldChannelName,
} from "../worldUpdate";
import {
  NoopWorldPublisher,
  PusherWorldPublisher,
} from "../../../infrastructure/realtime/PusherWorldPublisher";
import {
  OfflineWorldSubscriber,
  PusherWorldSubscriber,
  type PusherClientLike,
} from "../../../infrastructure/realtime/PusherWorldSubscriber";

const at = (world: World, updatedAt: string): World => ({
  ...world,
  metadata: { ...world.metadata, updatedAt },
});
const OLD = at(makeWorld(), "2026-01-01T00:00:01.000Z");
const NEW = at(makeWorld(), "2026-01-01T00:00:02.000Z");
const movedRole = (w: World): string | undefined => w.roleInstances[0]?.areaId;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakePublisher implements WorldRealtimePublisher {
  published: World[] = [];
  failWith: Error | null = null;
  async publishWorldUpdated(world: World): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.published.push(world);
  }
}

class FakeSubscriber implements WorldRealtimeSubscriber {
  handlers: WorldSubscriptionHandlers | null = null;
  worldId: string | null = null;
  unsubscribed = false;
  subscribe(worldId: string, handlers: WorldSubscriptionHandlers) {
    this.worldId = worldId;
    this.handlers = handlers;
    return () => {
      this.unsubscribed = true;
    };
  }
  emit(payload: unknown) {
    this.handlers?.onPayload(payload);
  }
  status(status: RealtimeStatus) {
    this.handlers?.onStatus(status);
  }
}

function readerOf(initial: () => World | Error) {
  return {
    async getById(): Promise<World> {
      const value = initial();
      if (value instanceof Error) throw value;
      return value;
    },
  };
}

function startSync(opts: {
  reader?: { getById(id: string): Promise<World> };
  subscriber?: FakeSubscriber;
}) {
  const subscriber = opts.subscriber ?? new FakeSubscriber();
  const shown: World[] = [];
  const statuses: RealtimeStatus[] = [];
  const errors: unknown[] = [];
  const stop = new WorldSync({
    worldId: "w1",
    subscriber,
    reader: opts.reader ?? readerOf(() => new WorldNotFoundError("w1")),
    onWorld: (w) => shown.push(w),
    onStatus: (s) => statuses.push(s),
    onError: (e) => errors.push(e),
  }).start();
  return { subscriber, shown, statuses, errors, stop };
}

describe("FASE 12 — 1. validación del payload", () => {
  it("un mensaje válido con snapshot se acepta", () => {
    const parsed = parseWorldUpdated(buildWorldUpdated(NEW), "w1");
    assert.ok(parsed.ok);
    if (parsed.ok) assert.deepEqual(parsed.world, NEW);
  });

  it("acepta el payload como string JSON (algunos transportes no lo parsean)", () => {
    const parsed = parseWorldUpdated(JSON.stringify(buildWorldUpdated(NEW)), "w1");
    assert.ok(parsed.ok);
  });

  it("rechaza basura, tipos desconocidos, otra partida y Worlds inválidos", () => {
    const valid = buildWorldUpdated(NEW);
    const cases: unknown[] = [
      null,
      "no es json",
      42,
      { ...valid, type: "OTRA_COSA" },
      { ...valid, worldId: "otra" },
      { ...valid, world: { ...NEW, areas: "no" } },
      { ...valid, world: { ...NEW, id: "otra" } },
      { type: WORLD_UPDATED },
    ];
    for (const payload of cases) {
      assert.equal(parseWorldUpdated(payload, "w1").ok, false, JSON.stringify(payload));
    }
  });

  it("los datos visuales inesperados no pasan a ser estado de dominio", () => {
    const dirty = {
      ...buildWorldUpdated(NEW),
      world: {
        ...NEW,
        areas: NEW.areas.map((a) => ({ ...a, bounds: { x: 1 }, assetId: "x" })),
        pixiObject: {},
      },
    };
    const parsed = parseWorldUpdated(dirty, "w1");
    assert.ok(parsed.ok && parsed.world);
    if (parsed.ok && parsed.world) {
      const text = JSON.stringify(parsed.world);
      assert.ok(!/bounds|assetId|pixiObject/.test(text));
    }
  });

  it("un snapshot que no cabe en el mensaje se anuncia sin World", () => {
    const message = buildWorldUpdated(NEW, 10);
    assert.equal(message.world, undefined);
    assert.equal(message.updatedAt, NEW.metadata.updatedAt);
    const parsed = parseWorldUpdated(message, "w1");
    assert.ok(parsed.ok && parsed.world === null);
  });

  it("no se anuncia un World inválido", () => {
    assert.throws(() => buildWorldUpdated({ ...NEW, areas: "no" } as never));
  });

  it("el canal se deriva de World.id y rechaza ids que Pusher no admite", () => {
    assert.equal(worldChannelName("w1"), "game-w1");
    assert.throws(() => worldChannelName("a:b"));
    assert.throws(() => worldChannelName(""));
  });
});

describe("FASE 12 — 2. orden (metadata.updatedAt)", () => {
  it("solo gana lo estrictamente más nuevo", () => {
    assert.equal(isNewerWorld(NEW, OLD), true);
    assert.equal(isNewerWorld(OLD, NEW), false);
    assert.equal(isNewerWorld(NEW, NEW), false);
    assert.equal(isNewerWorld(NEW, null), true);
    assert.equal(isNewerWorld(at(NEW, "no-es-fecha"), OLD), false);
  });

  it("viejo → nuevo: el nuevo gana", () => {
    const { subscriber, shown } = startSync({});
    subscriber.emit(buildWorldUpdated(OLD));
    subscriber.emit(buildWorldUpdated(NEW));
    assert.deepEqual(shown.map((w) => w.metadata.updatedAt), [
      OLD.metadata.updatedAt,
      NEW.metadata.updatedAt,
    ]);
  });

  it("nuevo → viejo: el viejo se ignora", () => {
    const { subscriber, shown } = startSync({});
    subscriber.emit(buildWorldUpdated(NEW));
    subscriber.emit(buildWorldUpdated(OLD));
    subscriber.emit(buildWorldUpdated(NEW)); // igual: tampoco se reenvía
    assert.equal(shown.length, 1);
    assert.equal(shown[0].metadata.updatedAt, NEW.metadata.updatedAt);
  });
});

describe("FASE 12 — 3. publicación (persistir primero, publicar después)", () => {
  it("create y save publican el World ya persistido, en ese orden", async () => {
    const calls: string[] = [];
    const inner = new InMemoryWorldRepository();
    const spied: WorldRepository = {
      create: async (w) => {
        await inner.create(w);
        calls.push("persist:create");
      },
      save: async (w) => {
        await inner.save(w);
        calls.push("persist:save");
      },
      getById: (id) => inner.getById(id),
      delete: (id) => inner.delete(id),
      list: () => inner.list(),
    };
    const publisher: WorldRealtimePublisher = {
      publishWorldUpdated: async () => {
        calls.push("publish");
      },
    };
    const repo = new PublishingWorldRepository(spied, publisher);
    await repo.create(OLD);
    await repo.save(NEW);
    assert.deepEqual(calls, [
      "persist:create",
      "publish",
      "persist:save",
      "publish",
    ]);
  });

  it("Caso B: si persistir falla no se publica y el error se propaga", async () => {
    const publisher = new FakePublisher();
    const repo = new PublishingWorldRepository(new InMemoryWorldRepository(), publisher);
    await assert.rejects(() => repo.save(NEW), WorldNotFoundError); // no existe: save falla
    assert.equal(publisher.published.length, 0);
  });

  it("Caso C: si publicar falla, el World queda guardado y no se lanza error", async () => {
    const publisher = new FakePublisher();
    publisher.failWith = new Error("pusher caído");
    const errors: unknown[] = [];
    const inner = new InMemoryWorldRepository();
    const repo = new PublishingWorldRepository(inner, publisher, (e) => errors.push(e));
    await repo.create(OLD);
    await repo.save(NEW);
    assert.equal((await inner.getById("w1")).metadata.updatedAt, NEW.metadata.updatedAt);
    assert.equal(errors.length, 2);
  });

  it("leer, listar y borrar no publican", async () => {
    const publisher = new FakePublisher();
    const repo = new PublishingWorldRepository(new InMemoryWorldRepository(), publisher);
    await repo.create(OLD);
    publisher.published.length = 0;
    await repo.getById("w1");
    await repo.list();
    await repo.delete("w1");
    assert.equal(publisher.published.length, 0);
  });

  it("Command → WorldEngine → persist → publish: el Player recibe el cambio semántico", async () => {
    const publisher = new FakePublisher();
    const service = new WorldLifecycleService(
      new PublishingWorldRepository(new InMemoryWorldRepository(), publisher),
    );
    const engine = new WorldEngine(makeWorld());
    await service.persist(engine.getWorld());
    engine.executeCommand({
      type: "MOVE_ROLE",
      roleInstanceId: "director-general",
      targetAreaId: "production-floor",
    });
    await service.persist(engine.getWorld());
    const last = publisher.published.at(-1)!;
    assert.equal(movedRole(last), "production-floor");
    assert.equal(publisher.published.length, 2);
  });

  it("una propuesta de IA o un Command sin aplicar no publican nada", () => {
    const publisher = new FakePublisher();
    // Simular no persiste: el único camino a publicar es persistir vía el repositorio
    const sim = simulateCommands(makeWorld(), [
      { type: "MOVE_ROLE", roleInstanceId: "director-general", targetAreaId: "warehouse" },
    ]);
    assert.ok(sim.ok);
    assert.equal(publisher.published.length, 0);
  });

  it("PusherWorldPublisher envía WORLD_UPDATED al canal de la partida", async () => {
    const sent: Array<{ channel: string; event: string; data: unknown }> = [];
    await new PusherWorldPublisher({
      trigger: async (channel, event, data) => {
        sent.push({ channel, event, data });
      },
    }).publishWorldUpdated(NEW);
    assert.equal(sent[0].channel, "game-w1");
    assert.equal(sent[0].event, WORLD_UPDATED);
    assert.ok(parseWorldUpdated(sent[0].data, "w1").ok);
  });

  it("sin configuración, el publisher nulo no hace nada ni falla", async () => {
    await new NoopWorldPublisher().publishWorldUpdated();
  });
});

describe("FASE 12 — 4. suscripción del Player", () => {
  it("carga inicial: muestra el World persistido sin esperar ningún evento", async () => {
    const { shown, subscriber } = startSync({ reader: readerOf(() => OLD) });
    await tick();
    assert.equal(subscriber.worldId, "w1");
    assert.equal(shown.length, 1);
    assert.deepEqual(shown[0], OLD);
  });

  it("si la partida aún no existe, espera el primer evento sin romperse", async () => {
    const { shown, subscriber, errors } = startSync({});
    await tick();
    assert.equal(shown.length, 0);
    assert.equal(errors.length, 1);
    subscriber.emit(buildWorldUpdated(NEW));
    assert.equal(shown.length, 1);
  });

  it("recibe, valida y entrega; un payload inválido se ignora", async () => {
    const { subscriber, shown, errors } = startSync({ reader: readerOf(() => OLD) });
    await tick();
    subscriber.emit({ type: WORLD_UPDATED, worldId: "w1", updatedAt: "x", world: { areas: 1 } });
    subscriber.emit("basura");
    assert.equal(shown.length, 1);
    assert.equal(errors.length, 2);
    subscriber.emit(buildWorldUpdated(NEW));
    assert.equal(shown.length, 2);
    assert.equal(movedRole(shown[1]), movedRole(NEW));
  });

  it("ignora mensajes de otra partida", async () => {
    const { subscriber, shown } = startSync({});
    subscriber.emit(buildWorldUpdated(at({ ...NEW, id: "otra" }, "2026-02-02T00:00:00.000Z")));
    assert.equal(shown.length, 0);
  });

  it("un aviso sin snapshot provoca la lectura de la persistencia", async () => {
    let current: World = OLD;
    const { subscriber, shown } = startSync({ reader: readerOf(() => current) });
    await tick();
    current = NEW;
    subscriber.emit(buildWorldUpdated(NEW, 10)); // sin World
    await tick();
    assert.equal(shown.at(-1)?.metadata.updatedAt, NEW.metadata.updatedAt);
    // un aviso viejo no dispara lecturas ni cambios
    const before = shown.length;
    subscriber.emit(buildWorldUpdated(OLD, 10));
    await tick();
    assert.equal(shown.length, before);
  });

  it("desconexión → reconexión: re-lee el World persistido y recupera lo perdido", async () => {
    let current: World = OLD;
    const { subscriber, shown, statuses } = startSync({ reader: readerOf(() => current) });
    await tick();
    subscriber.status("connected");
    await tick();
    subscriber.status("disconnected"); // se pierde el evento de NEW
    current = NEW;
    subscriber.status("connecting");
    subscriber.status("connected");
    await tick();
    assert.deepEqual(statuses, ["connected", "disconnected", "connecting", "connected"]);
    assert.equal(shown.at(-1)?.metadata.updatedAt, NEW.metadata.updatedAt);
  });

  it("tras cancelar, se desuscribe y no entrega nada más", async () => {
    const { subscriber, shown, stop } = startSync({});
    stop();
    assert.equal(subscriber.unsubscribed, true);
    subscriber.emit(buildWorldUpdated(NEW));
    assert.equal(shown.length, 0);
  });

  it("el World recibido alimenta el pipeline normal (LayoutEngine) sin otro modelo", async () => {
    const { subscriber, shown } = startSync({});
    subscriber.emit(buildWorldUpdated(NEW));
    const layout = new LayoutEngine().compute(shown[0]);
    assert.equal(layout.areas.length, NEW.areas.length);
  });
});

describe("FASE 12 — 5. adaptador Pusher del navegador", () => {
  function fakeClient() {
    const channelHandlers = new Map<string, (data: unknown) => void>();
    let onState: ((c: { current: string }) => void) | null = null;
    const log: string[] = [];
    const client: PusherClientLike = {
      connection: {
        bind: (_event, cb) => {
          onState = cb;
        },
      },
      subscribe: (channel) => {
        log.push(`subscribe:${channel}`);
        return { bind: (event, cb) => void channelHandlers.set(event, cb) };
      },
      unsubscribe: (channel) => void log.push(`unsubscribe:${channel}`),
      disconnect: () => void log.push("disconnect"),
    };
    return { client, channelHandlers, log, state: (s: string) => onState?.({ current: s }) };
  }

  it("se suscribe al canal de la partida, mapea estados y reenvía payloads", () => {
    const f = fakeClient();
    const statuses: RealtimeStatus[] = [];
    const payloads: unknown[] = [];
    const stop = new PusherWorldSubscriber(() => f.client).subscribe("w1", {
      onStatus: (s) => statuses.push(s),
      onPayload: (p) => payloads.push(p),
    });
    f.state("connected"); // el socket no basta: falta la suscripción
    f.channelHandlers.get("pusher:subscription_succeeded")?.(undefined);
    f.state("unavailable");
    f.state("connecting");
    f.channelHandlers.get(WORLD_UPDATED)?.({ hola: 1 });
    assert.deepEqual(statuses, ["connecting", "connected", "disconnected", "connecting"]);
    assert.deepEqual(payloads, [{ hola: 1 }]);
    stop();
    assert.deepEqual(f.log, ["subscribe:game-w1", "unsubscribe:game-w1", "disconnect"]);
  });

  it("sin clave pública el Player queda 'desconectado' pero no falla", () => {
    const statuses: RealtimeStatus[] = [];
    new OfflineWorldSubscriber().subscribe("w1", {
      onStatus: (s) => statuses.push(s),
      onPayload: () => {},
    })();
    assert.deepEqual(statuses, ["disconnected"]);
  });
});

describe("FASE 12 — 6. seguridad arquitectónica", () => {
  const root = process.cwd();
  const list = (dir: string) =>
    existsSync(join(root, dir))
      ? (readdirSync(join(root, dir), { recursive: true }) as string[])
          .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
          .map((f) => ({
            file: join(dir, f).replaceAll("\\", "/"),
            text: readFileSync(join(root, dir, f), "utf8"),
          }))
      : [];
  const src = list("src");

  it("el SDK de Pusher solo se importa en infrastructure/realtime", () => {
    const users = src
      .filter((f) => /from\s+["']pusher(-js)?["']/.test(f.text))
      .map((f) => f.file)
      .sort();
    assert.deepEqual(users, [
      "src/infrastructure/realtime/browserSubscriber.ts",
      "src/infrastructure/realtime/serverPublisher.ts",
    ]);
  });

  it("dominio, engine, IA, layout, assets, renderers, adapters y aplicación (salvo realtime) no conocen Pusher ni el realtime", () => {
    for (const dir of [
      "src/domain",
      "src/engine",
      "src/ai",
      "src/assets",
      "src/renderers",
      "src/adapters",
      "src/application/ai",
      "src/application/world",
      "src/application/persistence",
    ]) {
      for (const f of list(dir)) {
        assert.ok(
          !/pusher|application\/realtime|infrastructure\/realtime|WorldRealtime|WorldSync/i.test(f.text),
          `${f.file} conoce el realtime`,
        );
      }
    }
  });

  it("application/realtime es independiente del proveedor y de la base de datos", () => {
    for (const f of list("src/application/realtime")) {
      assert.ok(!/pusher|drizzle|postgres|infrastructure/i.test(f.text), `${f.file}`);
    }
  });

  it("el Player (Display, hook, composición) no importa Drizzle, PostgreSQL, secretos ni escribe", () => {
    const player = [
      "src/app/display/[sessionId]/page.tsx",
      "src/hooks/useWorldSync.ts",
      "src/app/lib/realtime.ts",
      "src/infrastructure/realtime/browserSubscriber.ts",
      "src/infrastructure/realtime/PusherWorldSubscriber.ts",
    ].map((file) => ({ file, text: readFileSync(join(root, file), "utf8") }));
    for (const { file, text } of player) {
      assert.ok(
        !/drizzle|postgres|DATABASE_URL|PUSHER_SECRET|PUSHER_APP_ID|serverWorldRepository|serverPublisher/.test(text),
        `${file} toca infraestructura de servidor o secretos`,
      );
      assert.ok(
        !/executeCommand|useWorldEngine|\.save\(|\.create\(|\.delete\(|publishWorldUpdated/.test(text),
        `${file} puede escribir`,
      );
    }
  });

  it("el secreto de Pusher solo se lee en el publisher de servidor y nunca con NEXT_PUBLIC_", () => {
    const users = src
      .filter((f) => /PUSHER_SECRET|PUSHER_APP_ID/.test(f.text))
      .map((f) => f.file);
    assert.deepEqual(users, ["src/infrastructure/realtime/serverPublisher.ts"]);
    for (const f of src) assert.ok(!/NEXT_PUBLIC_PUSHER_SECRET/.test(f.text));
  });

  it("no existe un endpoint abierto para publicar eventos arbitrarios", () => {
    assert.ok(!existsSync(join(root, "src/app/api/game-event/route.ts")));
    assert.ok(!existsSync(join(root, "src/app/lib/pusher.ts")));
    assert.ok(!src.some((f) => /game-event|emitGameEvent|BroadcastChannel/.test(f.text)));
  });

  it(".env.example documenta Pusher sin valores", () => {
    const env = readFileSync(join(root, ".env.example"), "utf8");
    for (const name of [
      "PUSHER_APP_ID",
      "PUSHER_SECRET",
      "NEXT_PUBLIC_PUSHER_KEY",
      "NEXT_PUBLIC_PUSHER_CLUSTER",
    ]) {
      assert.match(env, new RegExp(`^${name}=$`, "m"), name);
    }
  });
});
