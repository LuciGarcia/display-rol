import { WorldSchema, type World } from "@/domain/world/world";
import type { AreaType } from "@/domain/world/area";
import type { MapData, CharacterData, RoleDefinition } from "@/types/schema";

// TEMPORAL: eliminar cuando /api/generate-map devuelva un World directamente.
const AREA_TYPE_KEYWORDS: Array<[string, AreaType]> = [
  ["oficina", "office"],
  ["fabrica", "production_floor"],
  ["produccion", "production_floor"],
  ["deposito", "warehouse"],
  ["laboratorio", "laboratory"],
  ["circulacion", "corridor"],
  ["recepcion", "reception"],
];

export function toAreaType(legacyType: string): AreaType {
  const t = legacyType
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return AREA_TYPE_KEYWORDS.find(([k]) => t.includes(k))?.[1] ?? "custom";
}

export function legacyToWorld(
  mapData: MapData,
  characters: CharacterData[],
  roles: RoleDefinition[],
): World {
  const now = new Date().toISOString();

  const areas = mapData.areas.map((a) => ({
    id: a.id,
    name: a.name,
    type: toAreaType(a.type),
    state: {
      currentState: a.currentState || "NORMAL",
      allowedStates: a.allowedStates, // temporal: lo usa el panel del Master
    },
  }));

  const roleDefinitions = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.title,
  }));

  const roleInstances = characters.map((c) => {
    const area =
      mapData.areas.find(
        (a) =>
          c.x >= a.bounds.x &&
          c.x <= a.bounds.x + a.bounds.width &&
          c.y >= a.bounds.y &&
          c.y <= a.bounds.y + a.bounds.height,
      ) ?? mapData.areas[0];

    return {
      id: c.id,
      roleDefinitionId: c.roleId,
      name: c.name,
      areaId: area.id,
      localPosition: {
        x: Math.max(0, c.x - area.bounds.x),
        y: Math.max(0, c.y - area.bounds.y),
        z: 0,
      },
      metadata: { color: c.color },
    };
  });

  return WorldSchema.parse({
    id: `world-${Date.now()}`,
    metadata: { name: mapData.scenarioName, createdAt: now, updatedAt: now },
    environment: {
      id: `env-${Date.now()}`,
      type: "custom",
      name: mapData.scenarioName,
    },
    areas,
    entities: [],
    roleDefinitions,
    roleInstances,
    state: {},
  });
}
