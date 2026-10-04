import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FakeAIProvider } from "../../../ai/FakeAIProvider";
import { interpretInstruction } from "../../ai/interpretInstruction";
import { compileOperations, createEmptyWorld } from "../../ai/compileOperations";
import { buildSystemPrompt } from "../../ai/prompt";
import { EMPTY_WORLD_CONTEXT } from "../../ai/worldContext";
import {
  areaTypeFromHint,
  buildRoleSpawnCommands,
  toRoleDefinitions,
  type SetupRole,
} from "../spawnRoles";
import { WorldEngine } from "../../../engine/world/worldEngine";
import { simulateCommands } from "../../../engine/world/simulateCommands";
import { RoleDefinitionNotFoundError } from "../../../engine/world/errors";
import { LayoutEngine } from "../../../engine/layout/LayoutEngine";
import { AssetResolver } from "../../../assets/AssetResolver";
import { defaultAssetDefinitions } from "../../../assets/registry";
import { resolveWorldAssets } from "../../../assets/resolveWorldAssets";

const ROLES: SetupRole[] = [
  { id: "role_buho", name: "Búho", title: "Dirección General", targetAreaType: "oficina", color: "#0B45B5" },
  { id: "role_toro", name: "Toro", title: "Producción", targetAreaType: "fabrica", color: "#EF4444" },
  { id: "role_zorro", name: "Zorro", title: "Ventas", targetAreaType: "ventas", color: "#F97316" },
  { id: "role_castor", name: "Castor", title: "Ingeniería", targetAreaType: "laboratorio", color: "#10B981" },
];

const area = (id: string, type: string, name: string) => ({
  type: "ADD_AREA",
  area: {
    id,
    type,
    name,
    state: { currentState: "OPERATIVO", allowedStates: ["OPERATIVO", "PAUSADO"] },
  },
});

const FACTORY_PROPOSAL = JSON.stringify({
  version: 1,
  status: "ok",
  summary: "Planta con oficina, producción, laboratorio y ventas",
  world: { name: "Planta Metalúrgica", environmentType: "industrial_factory" },
  operations: [
    area("oficina", "office", "Oficina Central"),
    area("planta", "production_floor", "Nave de Producción"),
    area("lab", "laboratory", "Laboratorio de Calidad"),
    area("comercial", "custom", "Área de Ventas"),
    {
      type: "ADD_ENTITY",
      entity: { id: "torno", type: "machine", name: "Torno CNC", areaId: "planta", state: { condition: "damaged" } },
    },
  ],
});

async function generate(roles: readonly SetupRole[]) {
  const provider = new FakeAIProvider(() => FACTORY_PROPOSAL);
  const proposal = await interpretInstruction({
    provider,
    instruction: "Planta metalúrgica con oficina, producción, laboratorio y ventas",
    context: EMPTY_WORLD_CONTEXT,
    mode: "generate",
  });
  if (proposal.status !== "ok" || !proposal.world) throw new Error("propuesta inesperada");
  const base = createEmptyWorld(
    proposal.world,
    new Date("2026-01-01T00:00:00Z"),
    toRoleDefinitions(roles),
  );
  const aiCommands = compileOperations(proposal.operations, base);
  const first = simulateCommands(base, aiCommands);
  if (!first.ok) throw first.error;
  const commands = [...aiCommands, ...buildRoleSpawnCommands(first.world, roles)];
  return { base, commands, provider, result: simulateCommands(base, commands) };
}

describe("FASE 8 — A. roles del Master sembrados como Commands", () => {
  it("la pista del rol se traduce a un tipo de área; 'ventas' no equivale a un tipo concreto", () => {
    assert.equal(areaTypeFromHint("oficina"), "office");
    assert.equal(areaTypeFromHint("Fábrica"), "production_floor");
    assert.equal(areaTypeFromHint("depósito"), "warehouse");
    assert.equal(areaTypeFromHint("ventas"), null);
  });

  it("toRoleDefinitions conserva id y nombre; el cargo pasa a description", () => {
    const [def] = toRoleDefinitions(ROLES);
    assert.equal(def.id, "role_buho");
    assert.equal(def.name, "Búho");
    assert.equal(def.description, "Dirección General");
  });

  it("cada rol queda en el área que le corresponde, sin coordenadas decididas por nadie", async () => {
    const { result } = await generate(ROLES);
    assert.ok(result.ok);
    if (!result.ok) return;
    const areaOf = (name: string) =>
      result.world.roleInstances.find((r) => r.name === name)?.areaId;
    assert.equal(areaOf("Búho"), "oficina");
    assert.equal(areaOf("Toro"), "planta");
    assert.equal(areaOf("Castor"), "lab");
    assert.equal(areaOf("Zorro"), "comercial"); // coincide por nombre de área ("Ventas")
    for (const r of result.world.roleInstances) {
      assert.deepEqual(r.localPosition, { x: 0, y: 0, z: 0 });
    }
  });

  it("conserva el color como metadata y es determinista", async () => {
    const a = await generate(ROLES);
    const b = await generate(ROLES);
    assert.deepEqual(a.commands, b.commands);
    if (!a.result.ok) throw a.result.error;
    assert.equal(a.result.world.roleInstances[0].metadata?.color, "#0B45B5");
  });

  it("nombres repetidos generan ids únicos", async () => {
    const twins = [ROLES[0], { ...ROLES[0], id: "role_buho_2" }];
    const { result } = await generate(twins);
    assert.ok(result.ok);
    if (!result.ok) return;
    const ids = result.world.roleInstances.map((r) => r.id);
    assert.equal(new Set(ids).size, 2);
  });

  it("sin áreas no hay nada que sembrar", () => {
    assert.deepEqual(buildRoleSpawnCommands({ areas: [], roleInstances: [] }, ROLES), []);
  });

  it("sin la definición de rol, el WorldEngine rechaza el ADD_ROLE", async () => {
    const { base, commands } = await generate(ROLES);
    const withoutDefs = { ...base, roleDefinitions: [] };
    const sim = simulateCommands(withoutDefs, commands);
    assert.ok(!sim.ok);
    if (!sim.ok) assert.ok(sim.error instanceof RoleDefinitionNotFoundError);
  });
});

describe("FASE 8 — B. generación inicial: AIProvider → Proposal → Commands → WorldEngine → Layout → Assets", () => {
  it("el World resultante es válido y conserva el estado propuesto por la IA", async () => {
    const { result } = await generate(ROLES);
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.world.environment.type, "industrial_factory");
    assert.equal(result.world.areas.length, 4);
    assert.equal(result.world.roleDefinitions.length, ROLES.length);
    assert.equal(result.world.roleInstances.length, ROLES.length);
    assert.equal(result.world.areas[0].state.currentState, "OPERATIVO");
    assert.deepEqual(result.world.areas[0].state.allowedStates, ["OPERATIVO", "PAUSADO"]);
    assert.equal(result.world.entities[0].state.condition, "damaged");
  });

  it("el WorldEngine ejecuta el mismo lote y llega al mismo World que la simulación", async () => {
    const { base, commands, result } = await generate(ROLES);
    if (!result.ok) throw result.error;
    const engine = new WorldEngine(JSON.parse(JSON.stringify(base)));
    const events = commands.map((c) => engine.executeCommand(c));
    assert.equal(events.filter((e) => e.type === "ROLE_ADDED").length, ROLES.length);
    assert.deepEqual(engine.getWorld(), result.world);
  });

  it("Layout y Assets derivan del World sin que la IA intervenga", async () => {
    const { result } = await generate(ROLES);
    if (!result.ok) throw result.error;
    const layout = new LayoutEngine().compute(result.world);
    assert.equal(layout.areas.length, 4);
    assert.equal(layout.roles.length, ROLES.length);
    assert.ok(layout.entities.some((e) => e.id === "torno"));
    const assets = resolveWorldAssets(result.world, new AssetResolver(defaultAssetDefinitions));
    assert.ok(assets.entities.get("torno"));
  });

  it("un cambio posterior del World (ADD_ENTITY) se refleja de nuevo en el Layout", async () => {
    const { result } = await generate(ROLES);
    if (!result.ok) throw result.error;
    const engine = new WorldEngine(result.world);
    engine.executeCommand({
      type: "ADD_ENTITY",
      entity: { id: "pallet-1", type: "pallet", name: "Pallet", areaId: "planta", state: {} },
    } as never);
    const layout = new LayoutEngine().compute(engine.getWorld());
    assert.ok(layout.entities.some((e) => e.id === "pallet-1"));
  });

  it("el prompt de generación no permite roles ni coordenadas y pide el estado de cada área", () => {
    const prompt = buildSystemPrompt("generate");
    assert.ok(prompt.includes("No uses ADD_ROLE"));
    assert.ok(prompt.includes("currentState") && prompt.includes("allowedStates"));
    assert.ok(prompt.includes("Nunca incluyas coordenadas"));
  });

  it("el proveedor recibe solo la instrucción: sin contexto de mundo ni roles", async () => {
    const { provider } = await generate(ROLES);
    const call = provider.calls[0];
    assert.ok(!call.prompt.includes("<contexto>"));
    assert.ok(!/role_buho|Búho/.test(call.prompt));
  });
});

describe("FASE 8 — C. el legacy de generación ya no existe ni se consume", () => {
  const root = process.cwd();
  const sources = (readdirSync(join(root, "src"), { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
    .map((f) => ({ file: f, text: readFileSync(join(root, "src", f), "utf8") }));

  it("se eliminaron el endpoint y los módulos que solo él consumía", () => {
    for (const gone of [
      "src/app/api/generate-map/route.ts",
      "src/adapters/legacyToWorld.ts",
      "src/app/lib/prompts.ts",
      "src/app/lib/areaLayout.ts",
      "src/app/lib/furniturePacker.ts",
    ]) {
      assert.ok(!existsSync(join(root, gone)), `${gone} no debería existir`);
    }
  });

  it("nada referencia /api/generate-map ni legacyToWorld", () => {
    for (const { file, text } of sources) {
      assert.ok(!/generate-map|legacyToWorld/.test(text), `${file} referencia código eliminado`);
    }
  });

  it("el SDK de Google solo vive dentro del AIProvider", () => {
    const users = sources
      .filter(({ text }) => /from\s+["']@google\/generative-ai["']/.test(text))
      .map(({ file }) => file.replaceAll("\\", "/"));
    assert.deepEqual(users, ["ai/providers/GoogleAIProvider.ts"]);
  });

  it("la pantalla Master ya no depende de MapData ni de Konva", () => {
    for (const f of ["app/master/page.tsx", "hooks/useMasterGame.ts"]) {
      const text = sources.find((s) => s.file.replaceAll("\\", "/") === f)?.text ?? "";
      assert.ok(text.length > 0, `${f} no encontrado`);
      assert.ok(!/MapData|FloorMap|konva/i.test(text), `${f} usa el modelo legacy`);
    }
  });
});
