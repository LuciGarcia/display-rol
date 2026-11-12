import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ActiveWorldWatcher } from "../ActiveWorldWatcher";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("ActiveWorldWatcher — partida activa del Display", () => {
  it("avisa de la primera lectura y solo vuelve a avisar cuando cambia", async () => {
    let active: string | null = "a";
    const seen: (string | null)[] = [];
    const stop = new ActiveWorldWatcher({
      source: { getActiveId: async () => active },
      onActive: (id) => seen.push(id),
      pollIntervalMs: 10,
    }).start();
    await wait(45);
    assert.deepEqual(seen, ["a"]); // sin repetir mientras no cambie
    active = "b";
    await wait(35);
    active = null;
    await wait(35);
    stop();
    assert.deepEqual(seen, ["a", "b", null]);
  });

  it("un fallo se informa y, al recuperarse, se vuelve a notificar aunque el id sea el mismo", async () => {
    let fail = false;
    const seen: (string | null)[] = [];
    const errors: unknown[] = [];
    const stop = new ActiveWorldWatcher({
      source: {
        getActiveId: async () => {
          if (fail) throw new Error("red caída");
          return "a";
        },
      },
      onActive: (id) => seen.push(id),
      onError: (e) => errors.push(e),
      pollIntervalMs: 10,
    }).start();
    await wait(25);
    fail = true;
    await wait(35);
    fail = false;
    await wait(35);
    stop();
    assert.ok(errors.length >= 1);
    assert.deepEqual(seen, ["a", "a"]);
  });

  it("tras cancelar no se lee ni se notifica más", async () => {
    let reads = 0;
    let notified = 0;
    const stop = new ActiveWorldWatcher({
      source: { getActiveId: async () => (reads++, `w${reads}`) },
      onActive: () => notified++,
      pollIntervalMs: 10,
    }).start();
    await wait(25);
    stop();
    const [r, n] = [reads, notified];
    await wait(40);
    assert.equal(reads, r);
    assert.equal(notified, n);
  });
});
