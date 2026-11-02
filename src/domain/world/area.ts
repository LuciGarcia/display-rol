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

// Relaciones SEMÁNTICAS entre áreas. No contienen geometría ni implican pasillos o puertas:
// una etapa posterior las traducirá en criterios espaciales.
//  adjacency: deberían estar próximas o compartir límite.
//  proximity: deberían estar relativamente cerca.
//  access:    relación funcional de acceso (no crea una puerta ni un pasillo).
export const AreaRelationTypeSchema = z.enum([
  "adjacency",
  "proximity",
  "access",
]);
export type AreaRelationType = z.infer<typeof AreaRelationTypeSchema>;

// Direccionalidad (parte del significado de cada tipo, no un dato más):
//  adjacency y proximity son SIMÉTRICAS (A↔B es la misma relación que B↔A);
//  access es DIRIGIDA (A necesita llegar a B; no implica lo contrario).
export const isSymmetricRelationType = (type: AreaRelationType): boolean =>
  type !== "access";

//  preferred: preferencia (puede ignorarse).
//  required:  necesidad funcional (mayor prioridad en etapas posteriores; hoy no se garantiza).
export const AreaRelationStrengthSchema = z.enum(["preferred", "required"]);
export type AreaRelationStrength = z.infer<typeof AreaRelationStrengthSchema>;

// Se almacena en el área de ORIGEN y apunta al destino: una sola representación, sin duplicar
// la relación inversa. No se asume reciprocidad.
export const AreaRelationSchema = z.object({
  targetAreaId: z.string().min(1),
  type: AreaRelationTypeSchema,
  strength: AreaRelationStrengthSchema,
});
export type AreaRelation = z.infer<typeof AreaRelationSchema>;

const RelationsSchema = z
  .array(AreaRelationSchema)
  .default([])
  .superRefine((relations, ctx) => {
    const seen = new Set<string>();
    relations.forEach((r, i) => {
      const key = `${r.targetAreaId}|${r.type}`; // mismo destino y tipo = relación equivalente
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i],
          message: `relación duplicada hacia "${r.targetAreaId}" (${r.type})`,
        });
      }
      seen.add(key);
    });
  });

export const AreaSchema = z.object({
  id: z.string().min(1),
  type: AreaTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  state: WorldStateSchema.optional().default({}),
  relations: RelationsSchema, // mundos antiguos sin el campo → []
});

export type Area = z.infer<typeof AreaSchema>;
