import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorldSync } from "../WorldSync";
import { WorldNotFoundError } from "../../persistence/errors";
import { WorldAutosave } from "../../persistence/WorldAutosave";
import { describeStorageFailure } from "../../../infrastructure/persistence/http/worldsApi";
import type { World } from "../../../domain/world/world";
import type { WorldRealtimeSubscriber } from "../ports";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const w = (id: string, updatedAt: string) =>
  ({ id, metadata: { name: "n", updatedAt } }) as unknown as World;

function silentSubscriber(): WorldRealtimeSubscriber {
  return { subscribe: () => () => undefined } as unknown as WorldRealtimeSubscriber;
}

describe("reparación — polling de respaldo", () => {
  it("sin eventos ni conexión en vivo, el Display no queda desactualizado", async () => {
    let current = w("w1", "2026-01-01T00:00:00.000Z");
    const shown: World[] = [];
    const stop = new WorldSync({
      worldId: "w1",
      subscriber: silentSubscriber(),
      reader: { getById: async () => current },
      onWorld: (x) => shown.push(x),
      pollIntervalMs: 10,
    }).start();
    await wait(25);
    current = w("w1", "2026-01-02T00:00:00.000Z");
    await wait(40);
    stop();
    assert.equal(shown.at(-1)?.metadata.updatedAt, "2026-01-02T00:00:00.000Z");
  });

  it("sin pollIntervalMs no hay polling, y tras cancelar no se lee más", async () => {
    let reads = 0;
    const stop = new WorldSync({
      worldId: "w1",
      subscriber: silentSubscriber(),
      reader: { getById: async () => (reads++, w("w1", "2026-01-01T00:00:00.000Z")) },
      onWorld: () => undefined,
      pollIntervalMs: 10,
    }).start();
    await wait(30);
    stop();
    const after = reads;
    await wait(40);
    assert.equal(reads, after);
  });

  it("la partida inexistente se comunica como error de lectura y se recupera sola", async () => {
    let exists = false;
    const read: unknown[] = [];
    let ok = 0;
    const shown: World[] = [];
    const stop = new WorldSync({
      worldId: "w1",
      subscriber: silentSubscriber(),
      reader: {
        getById: async () => {
          if (!exists) throw new WorldNotFoundError("w1");
          return w("w1", "2026-01-01T00:00:00.000Z");
        },
      },
      onWorld: (x) => shown.push(x),
      onReadError: (e) => read.push(e),
      onReadOk: () => ok++,
      pollIntervalMs: 10,
    }).start();
    await wait(25);
    assert.ok(read[0] instanceof WorldNotFoundError);
    exists = true;
    await wait(30);
    stop();
    assert.equal(shown.length, 1);
    assert.ok(ok >= 1);
  });
});

describe("reparación — guardado", () => {
  it("un fallo al guardar rechaza (no se muestra como guardado) y el reintento sí guarda", async () => {
    let fail = true;
    const persisted: World[] = [];
    const autosave = new WorldAutosave({
      persist: async (x: World) => {
        if (fail) throw new Error("db caída");
        persisted.push(x);
      },
    } as never);
    const world = w("w1", "2026-01-01T00:00:00.000Z");
    await assert.rejects(autosave.notify(world));
    assert.equal(persisted.length, 0);
    fail = false;
    assert.equal(await autosave.retry(world), "saved");
    assert.equal(persisted.length, 1);
  });

  it("retry guarda aunque el World coincida con el recién cargado", async () => {
    const persisted: World[] = [];
    const autosave = new WorldAutosave({ persist: async (x: World) => void persisted.push(x) } as never);
    const world = w("w1", "2026-01-01T00:00:00.000Z");
    autosave.markLoaded(world);
    assert.equal(await autosave.retry(world), "saved");
  });
});

describe("reparación — diagnóstico", () => {
  it("el log recorre la cadena de causas hasta el error del driver", () => {
    const pg = Object.assign(new Error("secreto"), { name: "PostgresError", code: "42P01" });
    const drizzle = new Error("fallo", { cause: pg });
    const top = new Error("persistencia", { cause: drizzle });
    const chain = describeStorageFailure(top);
    assert.deepEqual(chain, ["Error", "Error", "PostgresError(42P01)"]);
    assert.ok(!chain.join().includes("secreto"));
  });
});
