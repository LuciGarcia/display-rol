import { CommandSchema, type Command } from "../../domain/events/command";
import { WorldSchema, type World } from "../../domain/world/world";
import type { EnvironmentType } from "../../domain/world/environment";
import type { RoleDefinition } from "../../domain/roles/role";
import type { AIOperation } from "./proposal";

export function slugify(raw: string, fallback: string): string {
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

type Kind = "area" | "entity" | "role";

// Convierte operaciones validadas en Command del dominio. No ejecuta nada.
// Los ids propuestos para crear se normalizan y las referencias posteriores se reescriben.
export function compileOperations(
  operations: readonly AIOperation[],
  world: Pick<World, "areas" | "entities" | "roleInstances">,
): Command[] {
  const taken: Record<Kind, Set<string>> = {
    area: new Set(world.areas.map((a) => a.id)),
    entity: new Set(world.entities.map((e) => e.id)),
    role: new Set(world.roleInstances.map((r) => r.id)),
  };
  const alias: Record<Kind, Map<string, string>> = {
    area: new Map(),
    entity: new Map(),
    role: new Map(),
  };
  const ref = (kind: Kind, id: string): string => alias[kind].get(id) ?? id;
  const register = (
    kind: Kind,
    suggested: string,
    fallback: string,
  ): string => {
    const id = uniqueId(slugify(suggested, fallback), taken[kind]);
    taken[kind].add(id);
    alias[kind].set(suggested, id);
    return id;
  };

  const raw: unknown[] = operations.map((op): unknown => {
    switch (op.type) {
      case "ADD_AREA":
        return {
          type: op.type,
          area: { ...op.area, id: register("area", op.area.id, op.area.type) },
        };
      case "ADD_ENTITY": {
        const id = register("entity", op.entity.id, op.entity.type);
        return {
          type: op.type,
          entity: { ...op.entity, id, areaId: ref("area", op.entity.areaId) },
        };
      }
      case "ADD_ROLE": {
        const id = register("role", op.role.id, "rol");
        return {
          type: op.type,
          role: { ...op.role, id, areaId: ref("area", op.role.areaId) },
        };
      }
      case "MOVE_ROLE":
        return {
          type: op.type,
          roleInstanceId: ref("role", op.roleInstanceId),
          targetAreaId: ref("area", op.targetAreaId),
        };
      case "SET_STATE": {
        const targetId =
          op.targetType === "AREA"
            ? ref("area", op.targetId)
            : op.targetType === "ENTITY"
              ? ref("entity", op.targetId)
              : op.targetId;
        return { ...op, targetId };
      }
      case "REMOVE_ENTITY":
        return { type: op.type, entityId: ref("entity", op.entityId) };
      case "REMOVE_AREA":
        return { type: op.type, areaId: ref("area", op.areaId) };
      case "REMOVE_ROLE":
        return {
          type: op.type,
          roleInstanceId: ref("role", op.roleInstanceId),
        };
    }
  });

  // Rellena defaults del dominio (p. ej. localPosition) y revalida con el mismo schema del motor.
  return raw.map((c) => CommandSchema.parse(c));
}

// Mundo vacío para la generación inicial: el contenido llega después como comandos ADD_*.
// Las definiciones de rol las configura el Master (no la IA) y se siembran aquí.
export function createEmptyWorld(
  header: { name: string; environmentType: EnvironmentType },
  now: Date = new Date(),
  roleDefinitions: RoleDefinition[] = [],
): World {
  const slug = slugify(header.name, "mundo");
  const ts = now.toISOString();
  return WorldSchema.parse({
    id: `world-${slug}`,
    metadata: { name: header.name, createdAt: ts, updatedAt: ts },
    environment: {
      id: `env-${slug}`,
      type: header.environmentType,
      name: header.name,
    },
    roleDefinitions,
  });
}
