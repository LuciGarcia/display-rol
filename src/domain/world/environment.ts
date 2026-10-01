import { z } from "zod";

import { WorldStateSchema } from "../common/state";

export const EnvironmentTypeSchema = z.enum([
  "industrial_factory",
  "hospital",
  "school",
  "office",
  "warehouse",
  "laboratory",
  "custom",
]);

export type EnvironmentType = z.infer<typeof EnvironmentTypeSchema>;

export const EnvironmentSchema = z.object({
  id: z.string().min(1),
  type: EnvironmentTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  properties: WorldStateSchema.optional().default({}),
});

export type Environment = z.infer<typeof EnvironmentSchema>;
