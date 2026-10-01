import { z } from "zod";
import { EnvironmentSchema } from "./environment";
import { AreaSchema } from "./area";
import { EntitySchema } from "./entity";
import { RoleDefinitionSchema, RoleInstanceSchema } from "../roles/role";
import { WorldStateSchema } from "../common/state";

export const WorldMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional().default("1.0.0"),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});
export type WorldMetadata = z.infer<typeof WorldMetadataSchema>;

export const WorldSchema = z.object({
  id: z.string().min(1),
  metadata: WorldMetadataSchema,
  environment: EnvironmentSchema,
  areas: z.array(AreaSchema).default([]),
  entities: z.array(EntitySchema).default([]),
  roleDefinitions: z.array(RoleDefinitionSchema).default([]),
  roleInstances: z.array(RoleInstanceSchema).default([]),
  state: WorldStateSchema.default({}),
});

export type World = z.infer<typeof WorldSchema>;
