import { z } from "zod";

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

// LEGACY: formato que consume el Display (FloorMap/Konva). Migra en la Fase 9.
// Área YA con bounds, obstáculos YA calculados
export const AreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  bounds: BoundsSchema,
  currentState: z.string(),
  allowedStates: z.array(z.string()),
  color: z.string(),
});

export const ObstacleSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  name: z.string(),
  bounds: BoundsSchema,
  rotation: z.number(),
  color: z.string(),
});

export const MapSchema = z.object({
  scenarioName: z.string(),
  dimensions: z.object({ width: z.number(), height: z.number() }),
  areas: z.array(AreaSchema),
  obstacles: z.array(ObstacleSchema),
});

export type MapData = z.infer<typeof MapSchema>;
export const RoleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  targetAreaType: z.string(),
  color: z.string(),
});
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  roleId: z.string(),
});
export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;
export type CharacterData = z.infer<typeof CharacterSchema>;
