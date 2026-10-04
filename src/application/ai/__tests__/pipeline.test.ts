import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FakeAIProvider } from "../../../ai/FakeAIProvider";
import { AIProviderError } from "../../../app/ai/errors";
import { AIProposalError } from "../errors";
import {
  interpretInstruction,
  parseProposalText,
} from "../interpretInstruction";
import { AIOperationSchema } from "../proposal";
import { buildWorldContext } from "../worldContext";
import { compileOperations, createEmptyWorld } from "../compileOperations";
import { CommandSchema } from "../../../domain/events/command";
import { WorldEngine } from "../../../engine/world/worldEngine";
import { simulateCommands } from "../../../engine/world/simulateCommands";
import {
  AreaNotFoundError,
  RoleDefinitionNotFoundError,
  RoleInstanceNotFoundError,
} from "../../../engine/world/errors";
import { LayoutEngine } from "../../../engine/layout/LayoutEngine";
import { AssetResolver } from "../../../assets/AssetResolver";
import { defaultAssetDefinitions } from "../../../assets/registry";
import { resolveWorldAssets } from "../../../assets/resolveWorldAssets";
import { makeWorld, okProposal } from "./fixtures";

const expectKind = (text: string, kind: "PARSE" | "VALIDATION") =>
  assert.throws(
    () => parseProposalText(text),
    (e: unknown) => e instanceof AIProposalError && e.kind === kind,
  );

function opsOf(text: string) {
  const p = parseProposalText(text);
  if (p.status !== "ok") throw new Error("se esperaba status ok");
  return p.operations;
}

const move = {
  type: "MOVE_ROLE",
  roleInstanceId: "director-general",
  targetAreaId: "production-floor",
};
const damagedMachine = {
  type: "ADD_ENTITY",
  entity: {
    id: "maquina",
    type: "machine",
    name: "Máquina",
    areaId: "production-floor",
    state: { condition: "damaged" },
  },
};

describe("FASE 7 — A. parsing de la respuesta de IA", () => {
  it("acepta JSON válido y JSON dentro de un bloque ```json", () => {
    assert.equal(parseProposalText(okProposal([move])).status, "ok");
    assert.equal(
      parseProposalText("```json\n" + okProposal([move]) + "\n```").status,
      "ok",
    );
  });
  it("JSON inválido → PARSE", () => {
    expectKind("esto no es json", "PARSE");
    expectKind("", "PARSE");
  });
  it("operaciones fuera del dominio → VALIDATION", () => {
    for (const type of ["EXECUTE_CODE", "RUN_SQL", "MODIFY_RENDERER"]) {
      expectKind(okProposal([{ type, code: "x" }]), "VALIDATION");
    }
  });
  it("campos faltantes y tipos incorrectos → VALIDATION", () => {
    expectKind(
      okProposal([{ type: "MOVE_ROLE", roleInstanceId: "a" }]),
      "VALIDATION",
    );
    expectKind(okProposal([{ ...move, roleInstanceId: 5 }]), "VALIDATION");
    expectKind(
      JSON.stringify({ version: 1, status: "ok", operations: [move] }),
      "VALIDATION",
    ); // sin summary
    expectKind(
      JSON.stringify({
        version: 2,
        status: "ok",
        summary: "x",
        operations: [move],
      }),
      "VALIDATION",
    );
  });
  it("rechaza datos espaciales o visuales que la IA no debe decidir", () => {
    expectKind(
      okProposal([{ ...move, localPosition: { x: 1, y: 2 } }]),
      "VALIDATION",
    );
    expectKind(
      okProposal([
        {
          ...damagedMachine,
          entity: { ...damagedMachine.entity, x: 10, y: 20, width: 5 },
        },
      ]),
      "VALIDATION",
    );
    expectKind(
      okProposal([
        {
          ...damagedMachine,
          entity: { ...damagedMachine.entity, localPosition: { x: 1, y: 2 } },
        },
      ]),
      "VALIDATION",
    );
    expectKind(
      okProposal([
        {
          ...damagedMachine,
          entity: { ...damagedMachine.entity, assetId: "damaged-machine-v2" },
        },
      ]),
      "VALIDATION",
    );
  });
  it("sin operaciones o con demasiadas → VALIDATION", () => {
    expectKind(okProposal([]), "VALIDATION");
    expectKind(
      okProposal(Array.from({ length: 31 }, () => move)),
      "VALIDATION",
    );
  });
  it("las operaciones de la IA son exactamente los Command del dominio (sin duplicar ni inventar)", () => {
    const ai = AIOperationSchema.options.map((o) => o.shape.type.value).sort();
    const cmd = CommandSchema.options.map((o) => o.shape.type.value).sort();
    assert.deepEqual(ai, cmd);
  });
});

describe("FASE 7 — B/H. aclaraciones", () => {
  const clarification = JSON.stringify({
    version: 1,
    status: "needs_clarification",
    message: "Existen dos roles que coinciden con 'director'.",
  });
  it("una propuesta de aclaración es válida y no trae operaciones", () => {
    const p = parseProposalText(clarification);
    assert.equal(p.status, "needs_clarification");
  });
  it("una aclaración con operaciones mezcladas → VALIDATION", () => {
    expectKind(
      JSON.stringify({
        version: 1,
        status: "needs_clarification",
        message: "x",
        operations: [move],
      }),
      "VALIDATION",
    );
  });
  it("el servicio devuelve la aclaración sin comandos", async () => {
    const fake = new FakeAIProvider(() => clarification);
    const p = await interpretInstruction({
      provider: fake,
      instruction: "Mueve al director a la fábrica",
      context: buildWorldContext(makeWorld()),
      mode: "modify",
    });
    assert.equal(p.status, "needs_clarification");
  });
});

describe("FASE 7 — C/D. AIProvider → propuesta", () => {
  it("pide JSON, envía contexto semántico y no filtra coordenadas", async () => {
    const fake = new FakeAIProvider(() => okProposal([move]));
    const p = await interpretInstruction({
      provider: fake,
      instruction: "El Director General se dirige a producción",
      context: buildWorldContext(makeWorld()),
      mode: "modify",
    });
    assert.equal(p.status, "ok");
    const call = fake.calls[0];
    assert.equal(call.responseFormat, "json");
    assert.ok(call.system?.includes("MOVE_ROLE"));
    assert.ok(call.prompt.includes("director-general"));
    assert.ok(!/localPosition|createdAt|metadata/.test(call.prompt));
  });
  it("el contexto del mundo no contiene posiciones ni metadata", () => {
    const json = JSON.stringify(buildWorldContext(makeWorld()));
    assert.ok(!/localPosition|metadata|createdAt/.test(json));
  });
  it("un fallo del proveedor sigue siendo AIProviderError (no se mezcla con errores de propuesta)", async () => {
    const fake = new FakeAIProvider(() => {
      throw new AIProviderError("RATE_LIMIT", "simulado");
    });
    await assert.rejects(
      () =>
        interpretInstruction({
          provider: fake,
          instruction: "x",
          context: buildWorldContext(makeWorld()),
          mode: "modify",
        }),
      (e: unknown) =>
        e instanceof AIProviderError && !(e instanceof AIProposalError),
    );
  });
  it("modo generate exige el encabezado del mundo", async () => {
    const fake = new FakeAIProvider(() =>
      okProposal([
        { type: "ADD_AREA", area: { id: "a", type: "custom", name: "A" } },
      ]),
    );
    await assert.rejects(
      () =>
        interpretInstruction({
          provider: fake,
          instruction: "hospital",
          context: buildWorldContext(makeWorld()),
          mode: "generate",
        }),
      (e: unknown) => e instanceof AIProposalError && e.kind === "VALIDATION",
    );
  });
});

describe("FASE 7 — E/F. propuesta → Command → WorldEngine", () => {
  function run(operations: unknown[]) {
    const world = makeWorld();
    const commands = compileOperations(opsOf(okProposal(operations)), world);
    const engine = new WorldEngine(world);
    const events = commands.map((c) => engine.executeCommand(c));
    return { engine, events, commands, world: engine.getWorld() };
  }

  it("MOVE_ROLE → ROLE_MOVED", () => {
    const { events, world } = run([move]);
    assert.equal(events[0].type, "ROLE_MOVED");
    assert.equal(world.roleInstances[0].areaId, "production-floor");
  });
  it("SET_STATE de área → STATE_CHANGED", () => {
    const { events, world } = run([
      {
        type: "SET_STATE",
        targetType: "AREA",
        targetId: "warehouse",
        key: "lighting",
        value: "off",
      },
    ]);
    assert.equal(events[0].type, "STATE_CHANGED");
    assert.equal(
      world.areas.find((a) => a.id === "warehouse")?.state.lighting,
      "off",
    );
  });
  it("ADD_ENTITY (máquina averiada) → ENTITY_ADDED, con id normalizado si ya existe", () => {
    const { events, world } = run([
      {
        ...damagedMachine,
        entity: { ...damagedMachine.entity, id: "machine-1" },
      },
    ]);
    assert.equal(events[0].type, "ENTITY_ADDED");
    const added = world.entities.find((e) => e.id === "machine-1-2");
    assert.equal(added?.state.condition, "damaged");
    assert.equal(added?.areaId, "production-floor");
  });
  it("ADD_AREA + ADD_ENTITY + SET_STATE sobre el área nueva dentro del mismo lote", () => {
    const { commands, world } = run([
      {
        type: "ADD_AREA",
        area: { id: "Quirófano", type: "custom", name: "Quirófano" },
      },
      {
        type: "ADD_ENTITY",
        entity: {
          id: "Camilla",
          type: "table",
          name: "Camilla",
          areaId: "Quirófano",
        },
      },
      {
        type: "SET_STATE",
        targetType: "AREA",
        targetId: "Quirófano",
        key: "lighting",
        value: "on",
      },
    ]);
    assert.deepEqual(
      commands.map((c) => c.type),
      ["ADD_AREA", "ADD_ENTITY", "SET_STATE"],
    );
    assert.ok(world.areas.some((a) => a.id === "quirofano"));
    assert.equal(
      world.entities.find((e) => e.id === "camilla")?.areaId,
      "quirofano",
    );
    assert.equal(
      world.areas.find((a) => a.id === "quirofano")?.state.lighting,
      "on",
    );
  });
  it("ADD_ROLE, REMOVE_ENTITY y REMOVE_ROLE", () => {
    const { events, world } = run([
      {
        type: "ADD_ROLE",
        role: {
          id: "dir-2",
          roleDefinitionId: "role-director",
          name: "Director 2",
          areaId: "office",
        },
      },
      { type: "REMOVE_ENTITY", entityId: "machine-1" },
      { type: "REMOVE_ROLE", roleInstanceId: "director-general" },
    ]);
    assert.deepEqual(
      events.map((e) => e.type),
      ["ROLE_ADDED", "ENTITY_REMOVED", "ROLE_REMOVED"],
    );
    assert.deepEqual(
      world.roleInstances.map((r) => r.id),
      ["dir-2"],
    );
    assert.equal(world.entities.length, 0);
  });
  it("la compilación es determinista", () => {
    const ops = opsOf(okProposal([damagedMachine, damagedMachine]));
    assert.deepEqual(
      compileOperations(ops, makeWorld()),
      compileOperations(ops, makeWorld()),
    );
  });
  it("el flujo continúa hacia Layout y Assets sin que la IA intervenga", () => {
    const { world } = run([damagedMachine]);
    const layout = new LayoutEngine().compute(world);
    assert.ok(layout.entities.some((e) => e.id === "maquina"));
    const assets = resolveWorldAssets(
      world,
      new AssetResolver(defaultAssetDefinitions),
    );
    assert.ok(assets.entities.get("maquina"));
  });
});

describe("FASE 7 — G. el WorldEngine es la autoridad (validación de dominio)", () => {
  const failureOf = (operations: unknown[]) => {
    const world = makeWorld();
    const before = JSON.stringify(world);
    const sim = simulateCommands(
      world,
      compileOperations(opsOf(okProposal(operations)), world),
    );
    assert.equal(
      JSON.stringify(world),
      before,
      "simulateCommands no debe mutar el World recibido",
    );
    if (sim.ok) throw new Error("se esperaba un fallo");
    return sim;
  };

  it("rol inexistente: Zod lo acepta pero el motor lo rechaza, y el lote no se aplica a medias", () => {
    const sim = failureOf([
      {
        type: "SET_STATE",
        targetType: "AREA",
        targetId: "warehouse",
        key: "lighting",
        value: "off",
      },
      {
        type: "MOVE_ROLE",
        roleInstanceId: "no-existe",
        targetAreaId: "office",
      },
    ]);
    assert.equal(sim.failedIndex, 1);
    assert.ok(sim.error instanceof RoleInstanceNotFoundError);
  });
  it("área inexistente → AreaNotFoundError", () => {
    const sim = failureOf([
      {
        type: "SET_STATE",
        targetType: "AREA",
        targetId: "no-existe",
        key: "lighting",
        value: "off",
      },
    ]);
    assert.ok(sim.error instanceof AreaNotFoundError);
  });
  it("definición de rol inexistente → RoleDefinitionNotFoundError", () => {
    const sim = failureOf([
      {
        type: "ADD_ROLE",
        role: {
          id: "x",
          roleDefinitionId: "role-fantasma",
          name: "X",
          areaId: "office",
        },
      },
    ]);
    assert.ok(sim.error instanceof RoleDefinitionNotFoundError);
  });
  it("lote válido: simulateCommands devuelve el mundo resultante sin tocar el original", () => {
    const world = makeWorld();
    const sim = simulateCommands(
      world,
      compileOperations(opsOf(okProposal([move])), world),
    );
    assert.ok(sim.ok);
    if (sim.ok)
      assert.equal(sim.world.roleInstances[0].areaId, "production-floor");
    assert.equal(world.roleInstances[0].areaId, "office");
  });
});

describe("FASE 7 — generación inicial (hospital)", () => {
  it("propuesta → mundo vacío + ADD_AREA → World válido → Layout", () => {
    const area = (id: string, type: string, name: string) => ({
      type: "ADD_AREA",
      area: { id, type, name },
    });
    const text = JSON.stringify({
      version: 1,
      status: "ok",
      summary: "Hospital con recepción, 3 habitaciones, quirófano y depósito",
      world: { name: "Hospital Central", environmentType: "hospital" },
      operations: [
        area("reception", "reception", "Recepción"),
        area("room-1", "custom", "Habitación 1"),
        area("room-2", "custom", "Habitación 2"),
        area("room-3", "custom", "Habitación 3"),
        area("surgery", "custom", "Quirófano"),
        area("warehouse", "warehouse", "Depósito"),
      ],
    });
    const p = parseProposalText(text);
    if (p.status !== "ok" || !p.world) throw new Error("propuesta inesperada");
    const base = createEmptyWorld(p.world, new Date("2026-01-01T00:00:00Z"));
    const sim = simulateCommands(base, compileOperations(p.operations, base));
    assert.ok(sim.ok);
    if (!sim.ok) return;
    assert.equal(sim.world.areas.length, 6);
    assert.equal(sim.world.environment.type, "hospital");
    assert.equal(new LayoutEngine().compute(sim.world).areas.length, 6);
  });
});
