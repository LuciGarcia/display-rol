import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueId } from "../../../application/ai/compileOperations";

describe("FASE 7 — normalización de ids", () => {
  it("slugify quita acentos, pasa a minúsculas y limpia símbolos", () => {
    assert.equal(slugify("Quirófano", "x"), "quirofano");
    assert.equal(slugify("  Máquina CNC #1 ", "x"), "maquina-cnc-1");
  });
  it("slugify usa el fallback si no queda nada", () => {
    assert.equal(slugify("¿¡?!", "item"), "item");
    assert.equal(slugify("", "item"), "item");
  });
  it("uniqueId agrega sufijo incremental sin repetir", () => {
    assert.equal(uniqueId("a", new Set()), "a");
    assert.equal(uniqueId("a", new Set(["a"])), "a-2");
    assert.equal(uniqueId("a", new Set(["a", "a-2"])), "a-3");
  });
});
