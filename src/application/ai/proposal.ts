import { z } from "zod";
import { EntitySchema } from "../../domain/world/entity";
import { AreaSchema } from "../../domain/world/area";
import { EnvironmentTypeSchema } from "../../domain/world/environment";
import { RoleInstanceSchema } from "../../domain/roles/role";
import {
  MoveRoleCommandSchema,
  SetStateCommandSchema,
  RemoveEntityCommandSchema,
  RemoveAreaCommandSchema,
  RemoveRoleCommandSchema,
} from "../../domain/events/command";
import { WorldContextSchema } from "../../application/ai/worldContext";

export const MAX_OPERATIONS = 30;

// Operaciones que la IA puede proponer: derivadas de los Command existentes (sin duplicarlos),
// sin campos espaciales (localPosition) ni metadata, y rechazando propiedades extra.
export const AIOperationSchema = z.discriminatedUnion("type", [
  MoveRoleCommandSchema.omit({ localPosition: true }).strict(),
  SetStateCommandSchema.strict(),
  RemoveEntityCommandSchema.strict(),
  RemoveAreaCommandSchema.strict(),
  RemoveRoleCommandSchema.strict(),
  z
    .object({
      type: z.literal("ADD_ENTITY"),
      entity: EntitySchema.pick({
        id: true,
        type: true,
        name: true,
        areaId: true,
        state: true,
      }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ADD_AREA"),
      area: AreaSchema.pick({
        id: true,
        type: true,
        name: true,
        description: true,
        state: true,
      }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ADD_ROLE"),
      role: RoleInstanceSchema.pick({
        id: true,
        roleDefinitionId: true,
        name: true,
        areaId: true,
      }).strict(),
    })
    .strict(),
]);
export type AIOperation = z.infer<typeof AIOperationSchema>;

const WorldHeaderSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    environmentType: EnvironmentTypeSchema,
  })
  .strict();

export const AIProposalSchema = z.discriminatedUnion("status", [
  z
    .object({
      version: z.literal(1),
      status: z.literal("ok"),
      summary: z.string().trim().min(1).max(300),
      world: WorldHeaderSchema.optional(), // solo al generar un mundo desde cero
      operations: z.array(AIOperationSchema).min(1).max(MAX_OPERATIONS),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      status: z.literal("needs_clarification"),
      message: z.string().trim().min(1).max(500),
    })
    .strict(),
]);
export type AIProposal = z.infer<typeof AIProposalSchema>;

// --- Protocolo cliente ↔ servidor (/api/ai/interpret) ---

export const InterpretRequestSchema = z
  .object({
    instruction: z.string().trim().min(1).max(1000),
    mode: z.enum(["modify", "generate"]),
    context: WorldContextSchema,
  })
  .strict();
export type InterpretRequest = z.infer<typeof InterpretRequestSchema>;

export const InterpretErrorKindSchema = z.enum([
  "request",
  "provider",
  "parse",
  "proposal",
  "unknown",
]);

export const InterpretResponseSchema = z.union([
  z.object({ ok: z.literal(true), proposal: AIProposalSchema }),
  z.object({
    ok: z.literal(false),
    kind: InterpretErrorKindSchema,
    code: z.string(),
    message: z.string(),
  }),
]);
export type InterpretResponse = z.infer<typeof InterpretResponseSchema>;
