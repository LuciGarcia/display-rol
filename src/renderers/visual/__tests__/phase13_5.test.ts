import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AreaTypeSchema, type Area } from "../../../domain/world/area";
import type { Entity } from "../../../domain/world/entity";
import type { RoleInstance } from "../../../domain/roles/role";
import {
  classifyStatus,
  estimateTextWidth,
  fitText,
  resolveAreaVisual,
  resolveEntityVisual,
  resolveRoleVisual,
  truncate,
} from "../semantics";
import { AREA_PALETTES } from "../theme";
import { PixiAreaRenderer } from "../../pixi/PixiAreaRenderer";
import { PixiEntityRenderer } from "../../pixi/PixiEntityRenderer";
import { PixiRoleRenderer } from "../../pixi/PixiRoleRenderer";
import { PixiBoardRenderer } from "../../pixi/PixiBoardRenderer";

const area = (over: Partial<Area> = {}): Area => ({
  id: "a1",
  type: "warehouse",
  name: "Zona",
  state: {},
  ...over,
});
const entity = (state: Entity["state"] = {}, type = "pallet"): Entity => ({
  id: "e1",
  type,
  name: "E",
  areaId: "a1",
  localPosition: { x: 0, y: 0, z: 0 },
  state,
});
const role = (over: Partial<RoleInstance> = {}): RoleInstance => ({
  id: "r1",
  roleDefinitionId: "def-1",
  name: "Marta",
  areaId: "a1",
  localPosition: { x: 0, y: 0, z: 0 },
  ...over,
});
const bounds = { x: 0, y: 0, width: 300, height: 200 };
const slot = { id: "s", areaId: "a1", x: 10, y: 20, width: 80, height: 70 };

describe("FASE 13.5 — semántica de estado", () => {
  const table: Array<[string, string]> = [
    ["OPERATIVO", "normal"],
    ["En producción", "active"],
    ["INCENDIO", "critical"],
    ["Evacuación", "critical"],
    ["Cerrado", "closed"],
    ["Inactivo", "closed"],
    ["Alerta", "warning"],
    ["Mantenimiento", "warning"],
    ["algo nunca visto", "neutral"],
  ];
  for (const [text, tone] of table) {
    it(`"${text}" → ${tone}`, () => assert.equal(classifyStatus(text), tone));
  }
  it("ignora acentos y mayúsculas", () => {
    assert.equal(classifyStatus("PRODUCCIÓN"), classifyStatus("produccion"));
  });
  it("vacío o null → neutral", () => {
    assert.equal(classifyStatus(null), "neutral");
    assert.equal(classifyStatus("  "), "neutral");
  });
});

describe("FASE 13.5 — resolveAreaVisual", () => {
  it("todos los tipos de área tienen paleta", () => {
    for (const t of AreaTypeSchema.options) assert.ok(AREA_PALETTES[t]);
  });
  it("combina luz apagada, colapso e inventario lleno", () => {
    const v = resolveAreaVisual(
      area({
        state: {
          lighting: "off",
          condition: "collapsed",
          inventory: "full",
          currentState: "CERRADO",
        },
      }),
    );
    assert.equal(v.dark, true);
    assert.deepEqual(v.overlays, ["hazard"]);
    assert.deepEqual(
      v.badges.map((b) => b.label),
      ["COLAPSADO", "INVENTARIO LLENO"],
    );
    assert.equal(v.tone, "closed");
  });
  it("inundación produce overlay flood", () => {
    assert.deepEqual(
      resolveAreaVisual(area({ state: { condition: "flooded" } })).overlays,
      ["flood"],
    );
  });
  it("no depende de id ni nombre", () => {
    const state = { lighting: "off", currentState: "ALERTA" };
    const a = resolveAreaVisual(area({ id: "x", name: "Uno", state }));
    const b = resolveAreaVisual(area({ id: "y", name: "Otro", state }));
    assert.deepEqual(a, b);
  });
  it("no muta el área", () => {
    const a = area({ state: { lighting: "off", condition: "damaged" } });
    const copy = structuredClone(a);
    resolveAreaVisual(a);
    assert.deepEqual(a, copy);
  });
  it("estado vacío no genera efectos", () => {
    const v = resolveAreaVisual(area());
    assert.equal(v.dark, false);
    assert.equal(v.overlays.length, 0);
    assert.equal(v.badges.length, 0);
    assert.equal(v.tone, "neutral");
  });
});

describe("FASE 13.5 — entidades y roles", () => {
  it("la condición de la entidad produce insignia", () => {
    assert.equal(
      resolveEntityVisual(entity({ condition: "broken" })).badge,
      "critical",
    );
    assert.equal(
      resolveEntityVisual(entity({ condition: "damaged" })).badge,
      "warning",
    );
    assert.equal(
      resolveEntityVisual(entity({ condition: "normal" })).badge,
      null,
    );
  });
  it("el color de entidad es determinista por tipo", () => {
    assert.equal(
      resolveEntityVisual(entity({}, "crane")).color,
      resolveEntityVisual(entity({}, "crane")).color,
    );
  });
  it("rol: respeta metadata.color válido e ignora el inválido", () => {
    assert.equal(
      resolveRoleVisual(role({ metadata: { color: "#ff0000" } })).color,
      0xff0000,
    );
    const fallback = resolveRoleVisual(
      role({ metadata: { color: "rojo" } }),
    ).color;
    assert.equal(fallback, resolveRoleVisual(role()).color);
  });
  it("rol: inicial del nombre", () => {
    assert.equal(resolveRoleVisual(role({ name: "ana" })).initial, "A");
  });
});

describe("FASE 13.5 — texto", () => {
  it("truncate y fitText respetan el ancho", () => {
    assert.equal(truncate("abcdef", 4), "abc…");
    assert.equal(truncate("abc", 4), "abc");
    assert.ok(fitText("x".repeat(100), 60, 12).length < 100);
    assert.ok(estimateTextWidth("abc", 10) > 0);
  });
});

describe("FASE 13.5 — render Pixi (smoke)", () => {
  const states: Area["state"][] = [
    {},
    { lighting: "off" },
    { condition: "collapsed", currentState: "INCENDIO" },
    { condition: "flooded", inventory: "full" },
    { currentState: "un nombre larguísimo ".repeat(10), inventory: "empty" },
  ];
  it("renderiza áreas en cualquier estado sin lanzar ni mutar", () => {
    for (const t of AreaTypeSchema.options) {
      for (const state of states) {
        const a = area({ type: t, state });
        const copy = structuredClone(a);
        for (const selected of [false, true]) {
          const c = PixiAreaRenderer.renderArea(
            a,
            bounds,
            selected,
            selected ? () => {} : undefined,
          );
          assert.equal(c.x, bounds.x);
        }
        assert.deepEqual(a, copy);
      }
    }
  });
  it("renderiza entidades y roles", () => {
    for (const cond of [undefined, "normal", "damaged", "broken"]) {
      PixiEntityRenderer.renderEntity(
        entity(cond ? { condition: cond } : {}),
        slot,
        null,
        async () => {
          throw new Error("no debe cargarse");
        },
      );
    }
    const r = PixiRoleRenderer.renderRole(
      role({ metadata: { color: "#00ff00" } }),
      slot,
    );
    assert.equal(r.x, slot.x + slot.width / 2);
  });
  it("el tablero cubre las áreas y tolera vacío", () => {
    assert.equal(PixiBoardRenderer.renderBoard([]).children.length, 0);
    assert.ok(
      PixiBoardRenderer.renderBoard([
        bounds,
        { x: 400, y: 0, width: 100, height: 100 },
      ]).children.length > 0,
    );
  });
});

describe("FASE 13.5 — arquitectura de la capa visual", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === "__tests__" ? [] : walk(p);
      return p.endsWith(".ts") ? [p] : [];
    });
  const files = walk("src/renderers");
  it("no hay escenarios cableados por id o nombre", () => {
    for (const f of files) {
      assert.doesNotMatch(
        readFileSync(f, "utf8"),
        /(area|world|entity|role)\.(id|name)\s*===/,
        f,
      );
    }
  });
  it("los renderers no importan IA, persistencia, tiempo real ni auth", () => {
    for (const f of files) {
      assert.doesNotMatch(
        readFileSync(f, "utf8"),
        /from\s+["'][^"']*(\/ai\/|persistence|realtime|auth|infrastructure)/,
        f,
      );
    }
  });
  it("los colores hexadecimales solo viven en theme.ts", () => {
    for (const f of files.filter((p) => !p.endsWith("theme.ts"))) {
      assert.doesNotMatch(readFileSync(f, "utf8"), /0x[0-9a-fA-F]{6}\b/, f);
    }
  });
});
