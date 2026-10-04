import { WorldSchema, type World } from "../../../domain/world/world";

export function makeWorld(): World {
  return WorldSchema.parse({
    id: "w1",
    metadata: { name: "Fábrica", createdAt: "x", updatedAt: "x" },
    environment: { id: "e1", type: "industrial_factory", name: "Fábrica" },
    areas: [
      { id: "office", type: "office", name: "Oficina" },
      {
        id: "production-floor",
        type: "production_floor",
        name: "Planta de producción",
      },
      {
        id: "warehouse",
        type: "warehouse",
        name: "Depósito",
        state: {
          currentState: "ORDENADO",
          allowedStates: ["ORDENADO", "CORTE ENERGÍA CRÍTICO"],
        },
      },
    ],
    entities: [
      {
        id: "machine-1",
        type: "machine",
        name: "Torno",
        areaId: "production-floor",
      },
    ],
    roleDefinitions: [{ id: "role-director", name: "Director General" }],
    roleInstances: [
      {
        id: "director-general",
        roleDefinitionId: "role-director",
        name: "Director General",
        areaId: "office",
      },
    ],
  });
}

export const okProposal = (
  operations: unknown[],
  summary = "resumen",
): string => JSON.stringify({ version: 1, status: "ok", summary, operations });
