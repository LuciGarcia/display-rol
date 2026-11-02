import { z } from "zod";
import { EnvironmentSchema } from "./environment";
import { AreaSchema, type Area } from "./area";
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

// Integridad de relaciones: el destino debe existir en el mismo mundo y no ser el propio origen.
export interface RelationIssue {
  areaId: string;
  targetAreaId: string;
  reason: "unknown-target" | "self";
}

export function findRelationIssues(
  areas: readonly Pick<Area, "id" | "relations">[],
): RelationIssue[] {
  const ids = new Set(areas.map((a) => a.id));
  const issues: RelationIssue[] = [];
  for (const a of areas) {
    for (const r of a.relations) {
      if (r.targetAreaId === a.id) {
        issues.push({
          areaId: a.id,
          targetAreaId: r.targetAreaId,
          reason: "self",
        });
      } else if (!ids.has(r.targetAreaId)) {
        issues.push({
          areaId: a.id,
          targetAreaId: r.targetAreaId,
          reason: "unknown-target",
        });
      }
    }
  }
  return issues;
}

export const WorldSchema = z
  .object({
    id: z.string().min(1),
    metadata: WorldMetadataSchema,
    environment: EnvironmentSchema,
    areas: z.array(AreaSchema).default([]),
    entities: z.array(EntitySchema).default([]),
    roleDefinitions: z.array(RoleDefinitionSchema).default([]),
    roleInstances: z.array(RoleInstanceSchema).default([]),
    state: WorldStateSchema.default({}),
  })
  .superRefine((world, ctx) => {
    findRelationIssues(world.areas).forEach((issue) =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["areas"],
        message:
          issue.reason === "self"
            ? `el área "${issue.areaId}" no puede relacionarse consigo misma`
            : `el área "${issue.areaId}" se relaciona con "${issue.targetAreaId}", que no existe`,
      }),
    );
  });

export type World = z.infer<typeof WorldSchema>;
