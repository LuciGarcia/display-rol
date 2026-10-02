// src/renderers/pixi/__tests__/camera.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Container } from "pixi.js";
import { PixiCamera } from "../PixiCamera";

describe("PixiCamera", () => {
  it("respeta límites de zoom", () => {
    const cam = new PixiCamera(new Container());
    cam.setZoom(99);
    assert.equal(cam.getZoom(), 2.5);
    cam.setZoom(0.01);
    assert.equal(cam.getZoom(), 0.5);
  });
  it("mantiene estable el punto bajo el cursor", () => {
    const c = new Container();
    const cam = new PixiCamera(c);
    const before = { x: (200 - c.x) / c.scale.x, y: (100 - c.y) / c.scale.y };
    cam.setZoom(2, 200, 100);
    const after = { x: (200 - c.x) / c.scale.x, y: (100 - c.y) / c.scale.y };
    assert.deepEqual(after, before);
  });
  it("pan y reset", () => {
    const cam = new PixiCamera(new Container());
    cam.pan(10, 20);
    assert.deepEqual(cam.getPosition(), { x: 10, y: 20 });
    cam.setZoom(2);
    cam.resetPosition();
    assert.deepEqual(cam.getPosition(), { x: 0, y: 0 });
    assert.equal(cam.getZoom(), 1);
  });
});
