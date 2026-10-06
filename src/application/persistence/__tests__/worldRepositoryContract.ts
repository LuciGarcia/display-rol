import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { World } from "../../../domain/world/world";
import { makeWorld } from "../../ai/__tests__/fixtures";
import {
  InvalidPersistedWorldError,
  WorldAlreadyExistsError,
  WorldNotFoundError,
} from "../errors";
import type { WorldRepository } from "../WorldRepository";

// Contrato que TODO adaptador de WorldRepository debe cumplir (memoria hoy, base de datos
// real después). Cada adaptador lo ejecuta con su propio almacenamiento.
export interface RepositoryHarness {
  /** Repositorio NUEVO sobre el mismo almacenamiento: simula destruir el anterior y reiniciar. */
  open(): WorldRepository;
  /** Escribe contenido crudo saltándose el repositorio (simula datos corruptos). Opcional. */
  plantRaw?(id: string, raw: string): void | Promise<void>;
}

const rejectsWith = (cls: new (...args: never[]) => Error) => (e: unknown) =>
  e instanceof cls;

const worldAt = (id: string, name: string, updatedAt: string): World => {
  const world = makeWorld();
  return {
    ...world,
    id,
    metadata: { ...world.metadata, name, updatedAt },
  };
};

export function describeWorldRepositoryContract(
  adapterName: string,
  createHarness: () => RepositoryHarness | Promise<RepositoryHarness>,
): void {
  describe(`WorldRepository (contrato) — ${adapterName}`, () => {
    it("create → getById devuelve un World equivalente, sin compartir referencias", async () => {
      const repo = (await createHarness()).open();
      const world = makeWorld();
      await repo.create(world);
      const first = await repo.getById(world.id);
      assert.deepEqual(first, world);
      first.areas[0].name = "MUTADO";
      assert.equal((await repo.getById(world.id)).areas[0].name, "Oficina");
    });

    it("create sobre un id existente → WorldAlreadyExistsError; getById inexistente → WorldNotFoundError", async () => {
      const repo = (await createHarness()).open();
      await repo.create(makeWorld());
      await assert.rejects(
        () => repo.create(makeWorld()),
        rejectsWith(WorldAlreadyExistsError),
      );
      await assert.rejects(
        () => repo.getById("nope"),
        rejectsWith(WorldNotFoundError),
      );
    });

    it("save reemplaza el snapshot; save de un World inexistente no lo crea", async () => {
      const repo = (await createHarness()).open();
      const world = makeWorld();
      await repo.create(world);
      await repo.save({
        ...world,
        metadata: { ...world.metadata, name: "Renombrada" },
      });
      assert.equal((await repo.getById(world.id)).metadata.name, "Renombrada");

      await assert.rejects(
        () => repo.save(worldAt("otro", "Otro", "2000-01-01T00:00:00.000Z")),
        rejectsWith(WorldNotFoundError),
      );
      await assert.rejects(
        () => repo.getById("otro"),
        rejectsWith(WorldNotFoundError),
      );
    });

    it("delete elimina la partida; repetirlo → WorldNotFoundError", async () => {
      const repo = (await createHarness()).open();
      await repo.create(makeWorld());
      await repo.delete("w1");
      await assert.rejects(
        () => repo.getById("w1"),
        rejectsWith(WorldNotFoundError),
      );
      await assert.rejects(
        () => repo.delete("w1"),
        rejectsWith(WorldNotFoundError),
      );
    });

    it("list devuelve solo id, name y updatedAt (= metadata.updatedAt), la más reciente primero", async () => {
      const repo = (await createHarness()).open();
      await repo.create(worldAt("a", "Vieja", "2000-01-01T00:00:00.000Z"));
      await repo.create(worldAt("b", "Nueva", "2000-01-03T00:00:00.000Z"));
      await repo.create(worldAt("c", "Media", "2000-01-02T00:00:00.000Z"));
      await repo.delete("c");

      const list = await repo.list();
      assert.deepEqual(list, [
        { id: "b", name: "Nueva", updatedAt: "2000-01-03T00:00:00.000Z" },
        { id: "a", name: "Vieja", updatedAt: "2000-01-01T00:00:00.000Z" },
      ]);
    });

    it("save conserva el updatedAt del World: el adaptador no inventa su propio timestamp", async () => {
      const repo = (await createHarness()).open();
      await repo.create(worldAt("a", "A", "2000-01-01T00:00:00.000Z"));
      await repo.save(worldAt("a", "A", "2000-06-15T12:00:00.000Z"));
      assert.equal(
        (await repo.getById("a")).metadata.updatedAt,
        "2000-06-15T12:00:00.000Z",
      );
      assert.equal(
        (await repo.list())[0].updatedAt,
        "2000-06-15T12:00:00.000Z",
      );
    });

    it("durabilidad: lo creado y lo guardado sobreviven a destruir el repositorio y abrir otro", async () => {
      const harness = await createHarness();
      const world = makeWorld();

      const repoA = harness.open();
      await repoA.create(world);

      const repoB = harness.open(); // A queda descartado: B solo puede leer el almacenamiento
      assert.deepEqual(await repoB.getById(world.id), world);
      await repoB.save({ ...world, state: { ...world.state, alarma: true } });

      const repoC = harness.open();
      assert.equal((await repoC.getById(world.id)).state.alarma, true);
      assert.equal((await repoC.list()).length, 1);
    });

    it("datos corruptos → InvalidPersistedWorldError, nunca un World", async (t) => {
      const harness = await createHarness();
      if (!harness.plantRaw)
        return t.skip("el adaptador no permite sembrar datos crudos");
      await harness.plantRaw("roto", "esto no es un World");
      await assert.rejects(
        () => harness.open().getById("roto"),
        rejectsWith(InvalidPersistedWorldError),
      );
    });
  });
}
