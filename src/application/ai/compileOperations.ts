import { CommandSchema, type Command } from "../../domain/events/command";
import { WorldSchema, type World } from "../../domain/world/world";
import type { EnvironmentType } from "../../domain/world/environment";
import type { RoleDefinition } from "../../domain/roles/role";
import type { AIOperation } from "./proposal";
import type { AreaRelation } from "../../domain/world/area";

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

  // Las áreas nuevas se registran primero: una relación puede apuntar a un área que la
  // propuesta crea más adelante.
  const newAreaIds = new Map<number, string>();
  operations.forEach((op, i) => {
    if (op.type === "ADD_AREA") {
      newAreaIds.set(i, register("area", op.area.id, op.area.type));
    }
  });
  const finalAreas = new Set(taken.area);
  for (const op of operations) {
    if (op.type === "REMOVE_AREA") finalAreas.delete(ref("area", op.areaId));
  }

  const raw: unknown[] = operations.map((op, i): unknown => {
    switch (op.type) {
      case "ADD_AREA": {
        const id = newAreaIds.get(i)!;
        const relations = sanitizeRelations(
          id,
          op.area.relations.map((r) => ({
            ...r,
            targetAreaId: ref("area", r.targetAreaId),
          })),
          finalAreas,
        );
        return { type: op.type, area: { ...op.area, id, relations } };
      }
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
  const commands = raw.map((c) => CommandSchema.parse(c));
  return orderAreaCreation(commands, new Set(world.areas.map((a) => a.id)));
}

// Descarta lo que el dominio rechazaría: destinos inexistentes, autorreferencias y duplicados
// (mismo destino y tipo). La propuesta de la IA no falla por una relación sobrante.
function sanitizeRelations(
  areaId: string,
  relations: readonly AreaRelation[],
  validTargets: ReadonlySet<string>,
): AreaRelation[] {
  const seen = new Set<string>();
  return relations.filter((r) => {
    const key = `${r.targetAreaId}|${r.type}`;
    if (r.targetAreaId === areaId || !validTargets.has(r.targetAreaId))
      return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// El motor exige que el destino de una relación exista al crear el área. Si alguna área nueva
// declara relaciones, las ADD_AREA pasan al principio, ordenadas por dependencia (estable); en un
// ciclo se descartan las relaciones hacia áreas aún no creadas. Sin relaciones no se reordena nada.
function orderAreaCreation(
  commands: Command[],
  existing: ReadonlySet<string>,
): Command[] {
  const adds = commands.filter((c) => c.type === "ADD_AREA");
  if (!adds.some((c) => c.area.relations.length > 0)) return commands;

  const created = new Set(existing);
  const pending = [...adds];
  const ordered: typeof adds = [];
  const pendingIds = () => new Set(pending.map((c) => c.area.id));
  while (pending.length > 0) {
    let k = pending.findIndex((c) =>
      c.area.relations.every((r) => created.has(r.targetAreaId)),
    );
    if (k === -1) {
      k = 0; // ciclo: se conserva el orden de la propuesta y se rompe el lazo
      const still = pendingIds();
      pending[0] = {
        ...pending[0],
        area: {
          ...pending[0].area,
          relations: pending[0].area.relations.filter(
            (r) => !still.has(r.targetAreaId),
          ),
        },
      };
    }
    const [next] = pending.splice(k, 1);
    created.add(next.area.id);
    ordered.push(next);
  }
  return [...ordered, ...commands.filter((c) => c.type !== "ADD_AREA")];
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
    id: `world-${slug}-${now.getTime().toString(36)}`, // único por partida: dos mundos con el mismo nombre no se pisan al persistir
    metadata: { name: header.name, createdAt: ts, updatedAt: ts },
    environment: {
      id: `env-${slug}`,
      type: header.environmentType,
      name: header.name,
    },
    roleDefinitions,
  });
}
