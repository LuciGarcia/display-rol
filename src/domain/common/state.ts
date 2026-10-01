import { z } from "zod";

export const DynamicValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export type DynamicValue = z.infer<typeof DynamicValueSchema>;

export const WorldStateSchema = z.record(z.string(), DynamicValueSchema);
export type WorldState = z.infer<typeof WorldStateSchema>;
