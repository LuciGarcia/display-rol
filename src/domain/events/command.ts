import { z } from "zod";
import { LocalPositionSchema, EntitySchema } from "../world/entity";
import { AreaSchema } from "../world/area";
import { RoleInstanceSchema } from "../roles/role";
import { DynamicValueSchema } from "../common/state";

export const MoveRoleCommandSchema = z.object({
  type: z.literal("MOVE_ROLE"),
  roleInstanceId: z.string().min(1),
  targetAreaId: z.string().min(1),
  localPosition: LocalPositionSchema.optional(),
});

export const SetStateCommandSchema = z.object({
  type: z.literal("SET_STATE"),
  targetType: z.enum(["WORLD", "AREA", "ENTITY"]),
  targetId: z.string().min(1),
  key: z.string().min(1),
  value: DynamicValueSchema,
});

export const AddEntityCommandSchema = z.object({
  type: z.literal("ADD_ENTITY"),
  entity: EntitySchema,
});

export const RemoveEntityCommandSchema = z.object({
  type: z.literal("REMOVE_ENTITY"),
  entityId: z.string().min(1),
});

export const AddAreaCommandSchema = z.object({
  type: z.literal("ADD_AREA"),
  area: AreaSchema,
});

export const RemoveAreaCommandSchema = z.object({
  type: z.literal("REMOVE_AREA"),
  areaId: z.string().min(1),
});

export const AddRoleCommandSchema = z.object({
  type: z.literal("ADD_ROLE"),
  role: RoleInstanceSchema,
});

export const RemoveRoleCommandSchema = z.object({
  type: z.literal("REMOVE_ROLE"),
  roleInstanceId: z.string().min(1),
});

export const CommandSchema = z.discriminatedUnion("type", [
  MoveRoleCommandSchema,
  SetStateCommandSchema,
  AddEntityCommandSchema,
  RemoveEntityCommandSchema,
  AddAreaCommandSchema,
  RemoveAreaCommandSchema,
  AddRoleCommandSchema,
  RemoveRoleCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;
