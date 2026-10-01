import { z } from "zod";
import { LocalPositionSchema } from "../world/entity";
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
  entityId: z.string().min(1),
  areaId: z.string().min(1),
});

export const EntityRemovedEventSchema = z.object({
  type: z.literal("ENTITY_REMOVED"),
  timestamp: z.string().datetime().or(z.string()),
  entityId: z.string().min(1),
});

export const WorldEventSchema = z.discriminatedUnion("type", [
  RoleMovedEventSchema,
  StateChangedEventSchema,
  EntityAddedEventSchema,
  EntityRemovedEventSchema,
]);

export type WorldEvent = z.infer<typeof WorldEventSchema>;
