import { z } from "zod";
import { LocalPositionSchema } from "../world/entity";
export const RoleDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional().default([]),
});
export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

export const RoleInstanceSchema = z.object({
  id: z.string().min(1),
  roleDefinitionId: z.string().min(1),
  name: z.string().min(1),
  areaId: z.string().min(1),
  localPosition: LocalPositionSchema.default({ x: 0, y: 0, z: 0 }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RoleInstance = z.infer<typeof RoleInstanceSchema>;
