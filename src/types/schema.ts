import { z } from "zod";

export const BoundsSchema = z.object({
  x: z.number().describe("Posición X en píxeles"),
  y: z.number().describe("Posición Y en píxeles"),
  width: z.number().describe("Ancho en píxeles"),
  height: z.number().describe("Alto en píxeles"),
});

export const AreaSchema = z.object({
  id: z.string().describe("ID único del área"),
  name: z.string().describe("Nombre legible del área"),
  type: z
    .string()
    .describe("Tipo de área (ej: oficina, fabrica, laboratorio, ventas)"),
  bounds: BoundsSchema,
  currentState: z.string().describe("Estado inicial"),
  allowedStates: z.array(z.string()).describe("Lista de estados posibles"),
  color: z.string().describe("Color Hexadecimal representativo"),
});

export const ObstacleSchema = z.object({
  id: z.string(),
  assetId: z
    .string()
    .describe("ID del asset visual, debe existir en el catálogo permitido"),
  name: z.string().describe("Nombre del objeto o máquina"),
  bounds: BoundsSchema,
  rotation: z.number().describe("Rotación en grados"),
  color: z.string().describe("Color Hexadecimal del objeto"),
});

// Esquema para la definición genérica y dinámica de Roles
export const RoleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().describe("Nombre del personaje / animal (ej: Búho, Toro)"),
  title: z
    .string()
    .describe("Área o cargo (ej: Dirección General, Producción)"),
  targetAreaType: z
    .string()
    .describe(
      "Tipo de área donde debe aparecer (ej: oficina, fabrica, laboratorio, ventas)",
    ),
  color: z.string().describe("Color distintivo de la ficha"),
});

// Esquema del Personaje en partida activa
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
  roleId: z.string(),
});

export const MapSchema = z.object({
  scenarioName: z.string().describe("Nombre general del mapa generado"),
  dimensions: z.object({
    width: z.number().describe("Ancho total (1000)"),
    height: z.number().describe("Alto total (600)"),
  }),
  areas: z.array(AreaSchema),
  obstacles: z.array(ObstacleSchema),
});

export type MapData = z.infer<typeof MapSchema>;
export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;
export type CharacterData = z.infer<typeof CharacterSchema>;

export function buildObstacleSchema(catalogIds: [string, ...string[]]) {
  return ObstacleSchema.extend({
    assetId: z
      .enum(catalogIds)
      .describe("Debe ser uno de los assetId del catálogo permitido"),
  });
}

// Versión del MapSchema con el assetId validado contra el catálogo real.
// Usar ESTE (no el MapSchema estático de arriba) para validar la respuesta de Gemini.
export function buildMapSchema(catalogIds: [string, ...string[]]) {
  const DynamicObstacleSchema = buildObstacleSchema(catalogIds);
  return z.object({
    scenarioName: z.string().describe("Nombre general del mapa generado"),
    dimensions: z.object({
      width: z.number(),
      height: z.number(),
    }),
    areas: z.array(AreaSchema),
    obstacles: z.array(DynamicObstacleSchema),
  });
}
