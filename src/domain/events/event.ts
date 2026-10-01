import { z } from "zod";
import { LocalPositionSchema, EntitySchema } from "../world/entity";
import { AreaSchema } from "../world/area";
import { RoleInstanceSchema } from "../roles/role";
import { DynamicValueSchema } from "../common/state";

export const RoleMovedEventSchema = z.object({
  type: z.literal("ROLE_MOVED"),
  timestamp: z.string().datetime().or(z.string()),
  roleInstanceId: z.string().min(1),
  fromAreaId: z.string().min(1),
  toAreaId: z.string().min(1),
  localPosition: LocalPositionSchema,
});

export const StateChangedEventSchema = z.object({
  type: z.literal("STATE_CHANGED"),
  timestamp: z.string().datetime().or(z.string()),
  targetType: z.enum(["WORLD", "AREA", "ENTITY"]),
  targetId: z.string().min(1),
  key: z.string().min(1),
  previousValue: DynamicValueSchema.optional(),
  newValue: DynamicValueSchema,
});

export const EntityAddedEventSchema = z.object({
  type: z.literal("ENTITY_ADDED"),
  timestamp: z.string().datetime().or(z.string()),
  entity: EntitySchema,
});

export const EntityRemovedEventSchema = z.object({
  type: z.literal("ENTITY_REMOVED"),
  timestamp: z.string().datetime().or(z.string()),
  entityId: z.string().min(1),
});

export const AreaAddedEventSchema = z.object({
  type: z.literal("AREA_ADDED"),
  timestamp: z.string().datetime().or(z.string()),
  area: AreaSchema,
});

export const AreaRemovedEventSchema = z.object({
  type: z.literal("AREA_REMOVED"),
  timestamp: z.string().datetime().or(z.string()),
  areaId: z.string().min(1),
});

export const RoleAddedEventSchema = z.object({
  type: z.literal("ROLE_ADDED"),
  timestamp: z.string().datetime().or(z.string()),
  role: RoleInstanceSchema,
});

export const RoleRemovedEventSchema = z.object({
  type: z.literal("ROLE_REMOVED"),
  timestamp: z.string().datetime().or(z.string()),
  roleInstanceId: z.string().min(1),
});

export const WorldEventSchema = z.discriminatedUnion("type", [
  RoleMovedEventSchema,
  StateChangedEventSchema,
  EntityAddedEventSchema,
  EntityRemovedEventSchema,
  AreaAddedEventSchema,
  AreaRemovedEventSchema,
  RoleAddedEventSchema,
  RoleRemovedEventSchema,
]);

export type WorldEvent = z.infer<typeof WorldEventSchema>;
