import { z } from "zod";

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

// Lo que la IA SÍ decide para cada área: qué es, no dónde va
export const AreaInputSchema = z.object({
  id: z.string().describe("ID único del área"),
  name: z.string().describe("Nombre legible del área"),
  type: z
    .string()
    .describe("Tipo de área (ej: oficina, fabrica, deposito, circulacion)"),
  currentState: z.string().describe("Estado inicial"),
  allowedStates: z.array(z.string()).describe("Lista de estados posibles"),
  color: z.string().describe("Color Hexadecimal representativo"),
  weight: z
    .number()
    .min(1)
    .max(3)
    .describe("Tamaño relativo: 1 chica, 2 mediana, 3 grande"),
  furnitureRequest: z.array(
    z.object({
      assetId: z.string(),
      quantity: z.number().int().min(1).max(6),
    }),
  ),
});

export function buildAreaInputSchema(catalogIds: [string, ...string[]]) {
  return AreaInputSchema.extend({
    furnitureRequest: z.array(
      z.object({
        assetId: z.enum(catalogIds),
        quantity: z.number().int().min(1).max(6),
      }),
    ),
  });
}

export function buildMapInputSchema(catalogIds: [string, ...string[]]) {
  return z.object({
    scenarioName: z.string(),
    dimensions: z.object({ width: z.number(), height: z.number() }),
    areas: z.array(buildAreaInputSchema(catalogIds)),
  });
}

// Lo que consume el frontend: área YA con bounds, obstáculos YA calculados
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
export type MapDataInput = z.infer<ReturnType<typeof buildMapInputSchema>>;
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
