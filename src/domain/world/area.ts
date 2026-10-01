import { z } from "zod";
import { WorldStateSchema } from "../common/state";

export const AreaTypeSchema = z.enum([
  "office",
  "production_floor",
  "warehouse",
  "loading_dock",
  "corridor",
  "reception",
  "laboratory",
  "custom",
]);

export type AreaType = z.infer<typeof AreaTypeSchema>;

export const AreaSchema = z.object({
  id: z.string().min(1),
  type: AreaTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  state: WorldStateSchema.optional().default({}),
});

export type Area = z.infer<typeof AreaSchema>;
