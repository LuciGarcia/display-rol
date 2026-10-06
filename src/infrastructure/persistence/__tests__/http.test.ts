import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { InMemoryWorldRepository } from "../InMemoryWorldRepository";
import { HttpWorldRepository } from "../http/HttpWorldRepository";
import { createWorldsApi } from "../http/worldsApi";
import { describeWorldRepositoryContract } from "../../../application/persistence/__tests__/worldRepositoryContract";
import { makeWorld } from "../../../application/ai/__tests__/fixtures";
import {
  PersistenceError,
  STORAGE_UNAVAILABLE_MESSAGE,
} from "../../../application/persistence/errors";
import type { WorldRepository } from "../../../application/persistence/WorldRepository";

const BASE = "http://localhost/api/worlds";

// Reemplaza al servidor: despacha cada petición a los mismos handlers que usan las rutas de Next
function fetchThrough(getRepository: () => WorldRepository): typeof fetch {
  const api = createWorldsApi(getRepository);
  return async (input, init) => {
    const request = new Request(input, init);
    const rest = new URL(request.url).pathname.slice("/api/worlds".length);
    const id = decodeURIComponent(rest.replace(/^\//, ""));
    if (!id) return request.method === "GET" ? api.list() : api.create(request);
    if (request.method === "GET") return api.get(id);
    if (request.method === "PUT") return api.save(id, request);
    return api.remove(id);
  };
}

// El adaptador HTTP debe cumplir el mismo contrato que cualquier WorldRepository
describeWorldRepositoryContract(
  "HttpWorldRepository → handlers → InMemoryWorldRepository",
  () => {
    const storage = new Map<string, string>();
    return {
      open: () =>
        new HttpWorldRepository(
          BASE,
          fetchThrough(() => new InMemoryWorldRepository(storage)),
        ),
      plantRaw: (id, raw) => void storage.set(id, raw),
    };
  },
);

describe("API de partidas — errores y frontera", () => {
  const secret = "password authentication failed for user admin at db.internal";
  const broken: WorldRepository = {
    create: async () => {
      throw new Error(secret);
    },
    getById: async () => {
      throw new Error(secret);
    },
    save: async () => {
      throw new Error(secret);
    },
    delete: async () => {
      throw new Error(secret);
    },
    list: async () => {
      throw new Error(secret);
    },
  };

  it("un fallo del almacenamiento responde 500 genérico, sin detalles del driver", async () => {
    mock.method(console, "error", () => {});
    const response = await fetchThrough(() => broken)(BASE);
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.ok(body.includes(STORAGE_UNAVAILABLE_MESSAGE));
    assert.ok(!/password|admin|internal/.test(body));
    mock.restoreAll();
  });

  it("el cliente lo recibe como PersistenceError genérico", async () => {
    mock.method(console, "error", () => {});
    const repo = new HttpWorldRepository(
      BASE,
      fetchThrough(() => broken),
    );
    await assert.rejects(
      () => repo.list(),
      (e: unknown) =>
        e instanceof PersistenceError &&
        e.message === STORAGE_UNAVAILABLE_MESSAGE,
    );
    mock.restoreAll();
  });

  it("si no hay repositorio disponible (p. ej. falta DATABASE_URL) también es un error controlado", async () => {
    mock.method(console, "error", () => {});
    const repo = new HttpWorldRepository(
      BASE,
      fetchThrough(() => {
        throw new Error("DATABASE_URL no está definida.");
      }),
    );
    await assert.rejects(
      () => repo.list(),
      (e: unknown) =>
        e instanceof PersistenceError &&
        e.message === STORAGE_UNAVAILABLE_MESSAGE,
    );
    mock.restoreAll();
  });

  it("un fallo de red se traduce a PersistenceError y conserva la causa", async () => {
    const offline = new TypeError("fetch failed");
    const repo = new HttpWorldRepository(BASE, async () => {
      throw offline;
    });
    await assert.rejects(
      () => repo.getById("x"),
      (e: unknown) => e instanceof PersistenceError && e.cause === offline,
    );
  });

  it("un cuerpo que no es un World válido se rechaza con 422", async () => {
    const send = fetchThrough(() => new InMemoryWorldRepository());
    const response = await send(BASE, { method: "POST", body: "no es json" });
    assert.equal(response.status, 422);
  });

  it("guardar con un id de URL distinto al del World se rechaza con 422", async () => {
    const repo = new InMemoryWorldRepository();
    await repo.create(makeWorld());
    const { serializeWorld } =
      await import("../../../application/persistence/serialization");
    const response = await fetchThrough(() => repo)(`${BASE}/otro-id`, {
      method: "PUT",
      body: serializeWorld(makeWorld()),
    });
    assert.equal(response.status, 422);
  });
});
