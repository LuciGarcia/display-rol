import { WorldSchema, type World } from "@/domain/world/world";
import type { MapData, CharacterData, RoleDefinition } from "@/types/schema";

// TEMPORAL: eliminar cuando /api/generate-map devuelva un World directamente.
// Convierte el modelo legacy (mapData + characters) en un World semántico.
// Las coordenadas de pantalla NO pasan al dominio: solo se usan para ubicar
// a cada personaje en su área y calcular su posición local.
export function legacyToWorld(
  mapData: MapData,
  characters: CharacterData[],
  roles: RoleDefinition[],
): World {
  const areas = mapData.areas.map((area) => ({
    id: area.id,
    name: area.name, // ASUNCIÓN: campo del legacy y de AreaSchema
    type: area.type, // ASUNCIÓN
    state: { currentState: area.currentState ?? "NORMAL" }, // ASUNCIÓN
  }));

  const roleDefinitions = roles.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title, // ASUNCIÓN: depende de RoleDefinitionSchema
    color: r.color, // ASUNCIÓN
  }));

  const roleInstances = characters.map((c) => {
    // Área que contiene al personaje; si ninguna, la primera
    const area =
      mapData.areas.find(
        (a) =>
          c.x >= a.bounds.x &&
          c.x <= a.bounds.x + a.bounds.width &&
          c.y >= a.bounds.y &&
          c.y <= a.bounds.y + a.bounds.height,
      ) ?? mapData.areas[0];

    return {
      id: c.id, // el id del personaje pasa a ser el id de la RoleInstance
      roleDefinitionId: c.roleId, // ASUNCIÓN: nombre del campo en CharacterData
      areaId: area.id,
      localPosition: {
        x: c.x - area.bounds.x,
        y: c.y - area.bounds.y,
        z: 0,
      },
    };
  });

  return WorldSchema.parse({
    id: `world-${Date.now()}`,
    metadata: { name: mapData.scenarioName }, // ASUNCIÓN
    environment: { type: mapData.scenarioName }, // ASUNCIÓN
    areas,
    entities: [],
    roleDefinitions,
    roleInstances,
    state: {},
  });
}
