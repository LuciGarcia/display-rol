import { z } from "zod";
import { LocalPositionSchema, EntitySchema } from "../world/entity";
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

export const CommandSchema = z.discriminatedUnion("type", [
  MoveRoleCommandSchema,
  SetStateCommandSchema,
  AddEntityCommandSchema,
  RemoveEntityCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;
