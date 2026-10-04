import { CommandSchema, type Command } from "../../domain/events/command";
import type { AreaType } from "../../domain/world/area";
import type { World } from "../../domain/world/world";
import type { RoleDefinition } from "../../domain/roles/role";
import { slugify, uniqueId } from "../ai/compileOperations";

// Rol configurado por el Master al preparar la partida. No lo decide la IA.
export interface SetupRole {
  id: string;
  name: string;
  title: string;
  targetAreaType: string;
  color: string;
}

const HINT_TO_AREA_TYPE: ReadonlyArray<readonly [string, AreaType]> = [
  ["oficina", "office"],
  ["fabrica", "production_floor"],
  ["produccion", "production_floor"],
  ["deposito", "warehouse"],
  ["laboratorio", "laboratory"],
  ["circulacion", "corridor"],
  ["recepcion", "reception"],
];

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// null cuando la pista no corresponde a un tipo concreto (p. ej. "ventas"):
// no se usa "custom" para emparejar porque coincidiría con cualquier área genérica.
export function areaTypeFromHint(hint: string): AreaType | null {
  const h = normalize(hint);
  return HINT_TO_AREA_TYPE.find(([keyword]) => h.includes(keyword))?.[1] ?? null;
}

export function toRoleDefinitions(
  roles: readonly SetupRole[],
): RoleDefinition[] {
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.title,
    capabilities: [],
  }));
}

// Comandos ADD_ROLE determinísticos para ubicar a los roles en las áreas ya creadas.
// Es semántico (areaId): la posición visual la decide el LayoutEngine.
export function buildRoleSpawnCommands(
  world: Pick<World, "areas" | "roleInstances">,
  roles: readonly SetupRole[],
): Command[] {
  if (world.areas.length === 0) return [];
  const taken = new Set(world.roleInstances.map((r) => r.id));

  return roles.map((role, index) => {
    const type = areaTypeFromHint(role.targetAreaType);
    const hint = normalize(role.targetAreaType);
    const area =
      (type && world.areas.find((a) => a.type === type)) ||
      world.areas.find((a) => normalize(a.name).includes(hint)) ||
      world.areas[index % world.areas.length];

    const id = uniqueId(slugify(role.name, "rol"), taken);
    taken.add(id);

    return CommandSchema.parse({
      type: "ADD_ROLE",
      role: {
        id,
        roleDefinitionId: role.id,
        name: role.name,
        areaId: area.id,
        metadata: { color: role.color },
      },
    });
  });
}
