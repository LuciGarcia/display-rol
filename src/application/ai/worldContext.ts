import { z } from "zod";
import { WorldStateSchema } from "../../domain/common/state";
import { AreaTypeSchema } from "../../domain/world/area";
import type { World } from "../../domain/world/world";

// Vista semántica del mundo para la IA: sin posiciones, metadata, layout ni assets.
export const WorldContextSchema = z.object({
  worldName: z.string(),
  environmentType: z.string(),
  worldState: WorldStateSchema,
  areas: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: AreaTypeSchema,
        state: WorldStateSchema,
      }),
    )
    .max(200),
  entities: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        name: z.string(),
        areaId: z.string(),
        state: WorldStateSchema,
      }),
    )
    .max(500),
  roleDefinitions: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .max(100),
  roles: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        roleDefinitionId: z.string(),
        areaId: z.string(),
      }),
    )
    .max(200),
});
export type WorldContext = z.infer<typeof WorldContextSchema>;

export const EMPTY_WORLD_CONTEXT: WorldContext = {
  worldName: "",
  environmentType: "custom",
  worldState: {},
  areas: [],
  entities: [],
  roleDefinitions: [],
  roles: [],
};

export function buildWorldContext(world: World): WorldContext {
  return {
    worldName: world.metadata.name,
    environmentType: world.environment.type,
    worldState: world.state,
    areas: world.areas.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      state: a.state,
    })),
    entities: world.entities.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      areaId: e.areaId,
      state: e.state,
    })),
    roleDefinitions: world.roleDefinitions.map((r) => ({
      id: r.id,
      name: r.name,
    })),
    roles: world.roleInstances.map((r) => ({
      id: r.id,
      name: r.name,
      roleDefinitionId: r.roleDefinitionId,
      areaId: r.areaId,
    })),
  };
}
