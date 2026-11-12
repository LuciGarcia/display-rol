import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemoryWorldRepository } from "../../../infrastructure/persistence/InMemoryWorldRepository";
import { createWorldsApi } from "../../../infrastructure/persistence/http/worldsApi";
import { PublishingWorldRepository } from "../../realtime/PublishingWorldRepository";
import { WorldLifecycleService } from "../WorldLifecycleService";
import { WorldNotFoundError } from "../errors";
import { makeWorld } from "../../ai/__tests__/fixtures";

describe("partida activa — servicio, API y publicación", () => {
  it("el servicio activa una partida y la reporta; una inexistente falla con WorldNotFoundError", async () => {
    const service = new WorldLifecycleService(new InMemoryWorldRepository());
    await service.persist(makeWorld());
    await service.activate("w1");
    assert.equal(await service.activeId(), "w1");
    await assert.rejects(
      () => service.activate("nope"),
      (e) => e instanceof WorldNotFoundError,
    );
  });

  it("API: GET devuelve {id}; PUT activa; cuerpo inválido → 422; inexistente → 404", async () => {
    const repo = new InMemoryWorldRepository();
    await repo.create(makeWorld());
    const api = createWorldsApi(() => repo);
    const put = (body: string) =>
      api.setActive(
        new Request("http://x/api/active-world", { method: "PUT", body }),
      );

    assert.deepEqual(await (await api.getActive()).json(), { id: "w1" });
    assert.equal((await put(JSON.stringify({ id: "w1" }))).status, 204);
    assert.equal((await put("no es json")).status, 422);
    assert.equal((await put(JSON.stringify({ id: "" }))).status, 422);
    assert.equal((await put(JSON.stringify({ id: "nope" }))).status, 404);
  });

  it("activar una partida no publica nada: no cambia ningún World", async () => {
    const published: unknown[] = [];
    const inner = new InMemoryWorldRepository();
    await inner.create(makeWorld());
    const repo = new PublishingWorldRepository(inner, {
      publishWorldUpdated: async (w) => void published.push(w),
    });
    await repo.setActive("w1");
    assert.equal(await repo.getActiveId(), "w1");
    assert.deepEqual(published, []);
  });
});
