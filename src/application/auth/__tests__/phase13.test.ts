import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { World } from "../../../domain/world/world";
import { makeWorld } from "../../ai/__tests__/fixtures";
import { InMemoryWorldRepository } from "../../../infrastructure/persistence/InMemoryWorldRepository";
import { createWorldsApi } from "../../../infrastructure/persistence/http/worldsApi";
import { serializeWorld } from "../../persistence/serialization";
import { PublishingWorldRepository } from "../../realtime/PublishingWorldRepository";
import type { WorldRealtimePublisher } from "../../realtime/ports";
import { authorize, type Operation, type Role } from "../authorization";
import { createAuthApi } from "../../../infrastructure/auth/authApi";
import {
  SESSION_COOKIE,
  createRequestGuard,
  type AuthConfig,
} from "../../../infrastructure/auth/requestGuard";
import {
  signSession,
  verifySession,
} from "../../../infrastructure/auth/sessionToken";

const SECRET = "s".repeat(40);
const KEY = "clave-de-master-123";
let nowMs = Date.parse("2026-06-01T00:00:00Z");
const config: AuthConfig = {
  secret: SECRET,
  masterKey: KEY,
  secureCookie: false,
  sessionTtlSeconds: 3600,
  now: () => nowMs,
};

const cookieFor = (role: Role, secret = SECRET) =>
  `${SESSION_COOKIE}=${signSession({ role }, secret, 3600, nowMs)}`;
const request = (
  method: string,
  path: string,
  options: {
    cookie?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {},
) =>
  new Request(`http://localhost${path}`, {
    method,
    body: options.body,
    headers: {
      "content-type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    },
  });

const OLD = makeWorld();
const NEW: World = {
  ...makeWorld(),
  metadata: {
    ...makeWorld().metadata,
    name: "Modificada",
    updatedAt: "2026-02-02T00:00:00.000Z",
  },
};

// Mismo cableado que las rutas reales: guard.protect + createWorldsApi + repositorio.
function harness(seed: World[] = []) {
  const store = new InMemoryWorldRepository();
  const published: World[] = [];
  const publisher: WorldRealtimePublisher = {
    publishWorldUpdated: async (w) => void published.push(w),
  };
  const repo = new PublishingWorldRepository(store, publisher);
  const guard = createRequestGuard(config);
  const api = createWorldsApi(() => repo);
  const routes = {
    list: guard.protect("world:list", (_r: Request) => api.list()),
    create: guard.protect("world:create", (r: Request) => api.create(r)),
    get: guard.protect("world:read", (_r: Request, id: string) => api.get(id)),
    save: guard.protect("world:save", (r: Request, id: string) =>
      api.save(id, r),
    ),
    remove: guard.protect("world:delete", (_r: Request, id: string) =>
      api.remove(id),
    ),
  };
  return {
    store,
    published,
    routes,
    seeded: Promise.all(seed.map((w) => store.create(w))),
  };
}

describe("FASE 13 — 1. autenticación", () => {
  const guard = createRequestGuard(config);

  it("credencial válida → actor", () => {
    assert.deepEqual(
      guard.authenticate(request("GET", "/", { cookie: cookieFor("MASTER") })),
      { role: "MASTER" },
    );
    assert.deepEqual(
      guard.authenticate(request("GET", "/", { cookie: cookieFor("PLAYER") })),
      { role: "PLAYER" },
    );
  });

  it("sin credencial → null", () => {
    assert.equal(guard.authenticate(request("GET", "/")), null);
  });

  it("credencial inválida, de otra firma, vencida o manipulada → null", () => {
    const player = signSession({ role: "PLAYER" }, SECRET, 3600, nowMs);
    const [version, , signature] = player.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ role: "MASTER", exp: Math.floor(nowMs / 1000) + 3600 }),
    ).toString("base64url");
    const cases = [
      `${SESSION_COOKIE}=basura`,
      `${SESSION_COOKIE}=`,
      `${SESSION_COOKIE}=v1.a.b`,
      `${SESSION_COOKIE}=${version}.${forgedPayload}.${signature}`, // rol cambiado, firma de PLAYER
      cookieFor("MASTER", "otro-secreto-distinto-de-32-caracteres!!"),
      `${SESSION_COOKIE}=${Buffer.from('{"role":"MASTER"}').toString("base64url")}`,
      "role=MASTER",
    ];
    for (const cookie of cases) {
      assert.equal(
        guard.authenticate(request("GET", "/", { cookie })),
        null,
        cookie,
      );
    }
    const expired = signSession({ role: "MASTER" }, SECRET, 10, nowMs - 60_000);
    assert.equal(verifySession(expired, SECRET, nowMs), null);
  });

  it("sin AUTH_SECRET válido el sistema falla cerrado aunque la cookie parezca correcta", () => {
    const cookie = cookieFor("MASTER");
    for (const secret of [undefined, "", "corto"]) {
      const closed = createRequestGuard({ ...config, secret });
      assert.equal(closed.authenticate(request("GET", "/", { cookie })), null);
    }
  });
});

describe("FASE 13 — 2. autorización (función pura)", () => {
  const writes: Operation[] = [
    "world:create",
    "world:save",
    "world:delete",
    "world:list",
    "ai:interpret",
  ];

  it("MASTER puede todo", () => {
    for (const op of [...writes, "world:read" as const]) {
      assert.equal(authorize({ role: "MASTER" }, op).allowed, true, op);
    }
  });

  it("PLAYER puede leer una partida y nada más (403)", () => {
    assert.equal(authorize({ role: "PLAYER" }, "world:read").allowed, true);
    for (const op of writes) {
      const decision = authorize({ role: "PLAYER" }, op);
      assert.ok(!decision.allowed && decision.status === 403, op);
    }
  });

  it("sin actor: lectura pública, el resto 401", () => {
    assert.equal(authorize(null, "world:read").allowed, true);
    for (const op of writes) {
      const decision = authorize(null, op);
      assert.ok(!decision.allowed && decision.status === 401, op);
    }
  });
});

describe("FASE 13 — 3. API /api/worlds", () => {
  it("anónimo: escribir o listar → 401 y la persistencia no cambia", async () => {
    const h = harness([OLD]);
    await h.seeded;
    const body = serializeWorld(NEW);
    const responses = await Promise.all([
      h.routes.create(
        request("POST", "/api/worlds", {
          body: serializeWorld({ ...NEW, id: "otro" }),
        }),
      ),
      h.routes.save(request("PUT", "/api/worlds/w1", { body }), "w1"),
      h.routes.remove(request("DELETE", "/api/worlds/w1"), "w1"),
      h.routes.list(request("GET", "/api/worlds")),
    ]);
    assert.deepEqual(
      responses.map((r) => r.status),
      [401, 401, 401, 401],
    );
    assert.deepEqual(await h.store.getById("w1"), OLD);
    assert.equal((await h.store.list()).length, 1);
    assert.equal(h.published.length, 0);
  });

  it("PLAYER: leer ✓; crear, guardar, borrar y listar → 403; PostgreSQL/almacén no cambia", async () => {
    const h = harness([OLD]);
    await h.seeded;
    const cookie = cookieFor("PLAYER");
    const read = await h.routes.get(
      request("GET", "/api/worlds/w1", { cookie }),
      "w1",
    );
    assert.equal(read.status, 200);
    const responses = await Promise.all([
      h.routes.create(
        request("POST", "/api/worlds", {
          cookie,
          body: serializeWorld({ ...NEW, id: "otro" }),
        }),
      ),
      h.routes.save(
        request("PUT", "/api/worlds/w1", { cookie, body: serializeWorld(NEW) }),
        "w1",
      ),
      h.routes.remove(request("DELETE", "/api/worlds/w1", { cookie }), "w1"),
      h.routes.list(request("GET", "/api/worlds", { cookie })),
    ]);
    assert.deepEqual(
      responses.map((r) => r.status),
      [403, 403, 403, 403],
    );
    assert.deepEqual(await h.store.getById("w1"), OLD);
    assert.equal((await h.store.list()).length, 1);
    assert.equal(h.published.length, 0); // un rechazo tampoco se difunde por tiempo real
  });

  it("anónimo puede leer por id (el Display), pero no ve el listado", async () => {
    const h = harness([OLD]);
    await h.seeded;
    assert.equal(
      (await h.routes.get(request("GET", "/api/worlds/w1"), "w1")).status,
      200,
    );
    assert.equal(
      (await h.routes.list(request("GET", "/api/worlds"))).status,
      401,
    );
  });

  it("MASTER: crear, guardar, borrar y listar funcionan, y guardar publica", async () => {
    const h = harness();
    const cookie = cookieFor("MASTER");
    assert.equal(
      (
        await h.routes.create(
          request("POST", "/api/worlds", { cookie, body: serializeWorld(OLD) }),
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await h.routes.save(
          request("PUT", "/api/worlds/w1", {
            cookie,
            body: serializeWorld(NEW),
          }),
          "w1",
        )
      ).status,
      204,
    );
    assert.equal((await h.store.getById("w1")).metadata.name, "Modificada");
    assert.equal(
      (await h.routes.list(request("GET", "/api/worlds", { cookie }))).status,
      200,
    );
    assert.equal(h.published.length, 2); // Master modifica → persistencia → publicación
    assert.equal(
      (
        await h.routes.remove(
          request("DELETE", "/api/worlds/w1", { cookie }),
          "w1",
        )
      ).status,
      204,
    );
    assert.equal((await h.store.list()).length, 0);
  });

  it("los cuerpos de error no filtran secretos ni detalles internos", async () => {
    const h = harness();
    const res = await h.routes.save(
      request("PUT", "/api/worlds/w1", { body: "{}" }),
      "w1",
    );
    const text = await res.text();
    assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ["code", "message"]);
    assert.ok(
      !text.includes(SECRET) && !text.includes(KEY) && !/stack|at /.test(text),
    );
  });
});

describe("FASE 13 — 4. el cliente no puede escalar privilegios", () => {
  it("rol, actor, permisos o worldId enviados por el cliente no otorgan nada", async () => {
    const h = harness([OLD]);
    await h.seeded;
    const attempts = [
      request("PUT", "/api/worlds/w1?role=MASTER&actor=MASTER", {
        body: JSON.stringify({
          role: "MASTER",
          actor: { role: "MASTER" },
          permissions: ["*"],
          worldId: "w1",
          world: NEW,
        }),
        headers: {
          "x-role": "MASTER",
          "x-actor": "MASTER",
          authorization: "Bearer MASTER",
        },
      }),
      request("PUT", "/api/worlds/w1", {
        cookie: "role=MASTER; actor=MASTER; master=1",
        body: serializeWorld(NEW),
      }),
      request("PUT", "/api/worlds/w1", {
        cookie: `${SESSION_COOKIE}=${Buffer.from(JSON.stringify({ role: "MASTER", exp: 9999999999 })).toString("base64url")}`,
        body: serializeWorld(NEW),
      }),
      request("PUT", "/api/worlds/w1", {
        cookie: cookieFor("MASTER", "x".repeat(40)),
        body: serializeWorld(NEW),
      }),
    ];
    for (const attempt of attempts) {
      assert.equal((await h.routes.save(attempt, "w1")).status, 401);
    }
    assert.deepEqual(await h.store.getById("w1"), OLD);
  });

  it("conocer World.id no da permiso de escritura", async () => {
    const h = harness([OLD]);
    await h.seeded;
    assert.equal(
      (await h.routes.remove(request("DELETE", "/api/worlds/w1"), "w1")).status,
      401,
    );
    assert.equal((await h.store.list()).length, 1);
  });
});

describe("FASE 13 — 5. emisión de la credencial de Master", () => {
  const guard = createRequestGuard(config);
  const api = createAuthApi(config, guard.authenticate);
  const login = (body: string, cfg = api) =>
    cfg.login(request("POST", "/api/auth/master", { body }));

  it("clave correcta → 204 con cookie HttpOnly + SameSite=Strict que identifica al MASTER", async () => {
    const res = await login(JSON.stringify({ key: KEY }));
    assert.equal(res.status, 204);
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.ok(!setCookie.includes(KEY));
    const cookie = setCookie.split(";")[0];
    assert.deepEqual(guard.authenticate(request("GET", "/", { cookie })), {
      role: "MASTER",
    });
    const session = await api.session(
      request("GET", "/api/auth/session", { cookie }),
    );
    assert.deepEqual(await session.json(), { role: "MASTER" });
  });

  it("clave incorrecta, ausente o malformada → 401 sin cookie", async () => {
    for (const body of [
      JSON.stringify({ key: "mala" }),
      JSON.stringify({}),
      JSON.stringify({ key: 123 }),
      "no-json",
    ]) {
      const res = await login(body);
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("set-cookie"), null);
    }
  });

  it("sin configuración → 503 y nunca emite credenciales", async () => {
    for (const cfg of [
      { ...config, masterKey: undefined },
      { ...config, secret: undefined },
      { ...config, masterKey: "corta" },
    ]) {
      const closed = createAuthApi(cfg, createRequestGuard(cfg).authenticate);
      const res = await login(JSON.stringify({ key: KEY }), closed);
      assert.equal(res.status, 503);
      assert.equal(res.headers.get("set-cookie"), null);
    }
  });

  it("anónimo → role null; logout invalida la cookie; en producción la cookie es Secure", async () => {
    assert.deepEqual(await (await api.session(request("GET", "/"))).json(), {
      role: null,
    });
    assert.match(api.logout().headers.get("set-cookie") ?? "", /Max-Age=0/);
    const prod = createAuthApi(
      { ...config, secureCookie: true },
      guard.authenticate,
    );
    const res = await login(JSON.stringify({ key: KEY }), prod);
    assert.match(res.headers.get("set-cookie") ?? "", /Secure/);
  });
});

describe("FASE 13 — 6. realtime y autorización", () => {
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

  it("solo se publica tras persistir: el único que invoca publishWorldUpdated es el repositorio decorado", () => {
    const callers = src
      .filter((f) => /\.publishWorldUpdated\(/.test(f.text))
      .map((f) => f.file);
    assert.deepEqual(callers, [
      "src/application/realtime/PublishingWorldRepository.ts",
    ]);
  });

  it("no existe endpoint de autorización de canales ni de publicación: Pusher no decide permisos", () => {
    assert.ok(!existsSync(join(root, "src/app/api/pusher")));
    assert.ok(
      !src.some((f) =>
        /pusher\/auth|authorizeChannel|authenticateUser/.test(f.text),
      ),
    );
  });
});

describe("FASE 13 — 7. auditoría de rutas y arquitectura", () => {
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

  it("todo handler de /api (salvo /api/auth) pasa por guard.protect", () => {
    const routes = list("src/app/api").filter(
      (f) =>
        f.file.endsWith("route.ts") && !f.file.startsWith("src/app/api/auth/"),
    );
    assert.ok(routes.length >= 3);
    for (const { file, text } of routes) {
      const handlers =
        text.match(
          /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
        ) ?? [];
      const protectedOnes =
        text.match(
          /export const (GET|POST|PUT|PATCH|DELETE) = guard\.protect\(/g,
        ) ?? [];
      assert.ok(handlers.length > 0, file);
      assert.equal(
        protectedOnes.length,
        handlers.length,
        `${file} tiene handlers sin proteger`,
      );
    }
  });

  it("dominio, engine, IA, layout, assets, renderers, repositorios y realtime no conocen la autenticación", () => {
    const auth =
      /application\/auth|infrastructure\/auth|app\/lib\/auth|\bActor\b|\bauthorize\(|MASTER_KEY|AUTH_SECRET|SESSION_COOKIE|jsonwebtoken|\bcookie/i;
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
      "src/application/realtime",
      "src/infrastructure/persistence",
      "src/infrastructure/realtime",
    ]) {
      for (const f of list(dir))
        assert.ok(!auth.test(f.text), `${f.file} conoce la autenticación`);
    }
  });

  it("el navegador no importa el módulo de servidor ni conoce los secretos", () => {
    const browser = [
      ...list("src/hooks"),
      ...list("src/components"),
      ...list("src/renderers"),
      ...list("src/app/display"),
      ...list("src/app/master"),
      ...src.filter(
        (f) =>
          f.file === "src/app/lib/realtime.ts" ||
          f.file === "src/app/lib/worldLifecycle.ts",
      ),
    ];
    for (const f of browser) {
      assert.ok(
        !/app\/lib\/auth|infrastructure\/auth|AUTH_SECRET|MASTER_KEY|DATABASE_URL|PUSHER_SECRET/.test(
          f.text,
        ),
        f.file,
      );
    }
  });

  it("ninguna variable secreta se expone con NEXT_PUBLIC_", () => {
    for (const f of src)
      assert.ok(
        !/NEXT_PUBLIC_(AUTH|MASTER|DATABASE|PUSHER_SECRET|PUSHER_APP)/.test(
          f.text,
        ),
        f.file,
      );
    const env = readFileSync(join(root, ".env.example"), "utf8");
    assert.ok(!/NEXT_PUBLIC_(AUTH|MASTER|DATABASE|PUSHER_SECRET)/.test(env));
    for (const name of ["AUTH_SECRET", "MASTER_KEY"])
      assert.match(env, new RegExp(`^${name}=$`, "m"));
  });

  it("el secreto de sesión y la clave de Master solo se leen en app/lib/auth.ts", () => {
    const users = src
      .filter((f) => /process\.env\.(AUTH_SECRET|MASTER_KEY)/.test(f.text))
      .map((f) => f.file);
    assert.deepEqual(users, ["src/app/lib/auth.ts"]);
  });
});
