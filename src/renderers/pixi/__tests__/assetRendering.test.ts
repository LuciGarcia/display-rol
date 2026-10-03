import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Sprite, Texture } from "pixi.js";
import { PixiEntityRenderer } from "../PixiEntityRenderer";
import type { TextureLoader } from "../spriteAsset";
import type { ResolvedAsset } from "../../../assets/types";

const entity = {
  id: "p1",
  type: "pallet",
  name: "P1",
  areaId: "a1",
  localPosition: { x: 0, y: 0, z: 0 },
  state: {},
};
const slot = { id: "p1", areaId: "a1", x: 10, y: 20, width: 80, height: 70 };
const asset = (kind: ResolvedAsset["kind"]): ResolvedAsset => ({
  assetId: "pallet-normal-2d",
  representation: "2d",
  kind,
  source: "test://pallet",
});
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("FASE 5 — el renderer consume ResolvedAsset", () => {
  it("pide la textura del source resuelto y muestra un Sprite", async () => {
    const calls: string[] = [];
    const loader: TextureLoader = async (s) => {
      calls.push(s);
      return Texture.EMPTY;
    };
    const c = PixiEntityRenderer.renderEntity(
      entity,
      slot,
      asset("svg"),
      loader,
    );
    await flush();
    assert.deepEqual(calls, ["test://pallet"]);
    assert.ok(c.children.some((ch) => ch instanceof Sprite));
  });
  it("sin asset usa placeholder y no carga nada", async () => {
    let called = false;
    const loader: TextureLoader = async () => {
      called = true;
      return Texture.EMPTY;
    };
    const c = PixiEntityRenderer.renderEntity(entity, slot, null, loader);
    await flush();
    assert.equal(called, false);
    assert.ok(!c.children.some((ch) => ch instanceof Sprite));
  });
  it("si la carga falla, queda el placeholder y no se rompe", async () => {
    const original = console.error;
    console.error = () => {};
    const loader: TextureLoader = async () => {
      throw new Error("falló");
    };
    const c = PixiEntityRenderer.renderEntity(
      entity,
      slot,
      asset("svg"),
      loader,
    );
    await flush();
    console.error = original;
    assert.ok(!c.children.some((ch) => ch instanceof Sprite));
  });
  it("assets 3D (model) no se cargan: queda el placeholder", async () => {
    let called = false;
    const loader: TextureLoader = async () => {
      called = true;
      return Texture.EMPTY;
    };
    PixiEntityRenderer.renderEntity(entity, slot, asset("model"), loader);
    await flush();
    assert.equal(called, false);
  });
});
