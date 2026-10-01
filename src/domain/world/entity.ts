import { z } from "zod";
import { WorldStateSchema } from "../common/state";

export const LocalPositionSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().optional().default(0),
});

export type LocalPosition = z.infer<typeof LocalPositionSchema>;

export const EntitySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  areaId: z.string().min(1),
  localPosition: LocalPositionSchema.default({ x: 0, y: 0, z: 0 }),
  state: WorldStateSchema.optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Entity = z.infer<typeof EntitySchema>;
