import { z } from "zod";
import { AIProviderError } from "../ai/errors";

// Contrato neutral: sin tipos del SDK, sin dominio, sin nombres de modelo.
export const AIRequestSchema = z.object({
  prompt: z.string().trim().min(1, "El prompt no puede estar vacío"),
  system: z.string().optional(),
  responseFormat: z.enum(["text", "json"]).default("text"),
  temperature: z.number().min(0).max(2).optional(),
});
export type AIRequest = z.input<typeof AIRequestSchema>;
export type ParsedAIRequest = z.output<typeof AIRequestSchema>;

export interface AIResponse {
  text: string;
  providerId: string;
  model: string; // informativo, para debugging
}

export interface AIProvider {
  readonly id: string;
  generate(request: AIRequest): Promise<AIResponse>;
}

export function parseAIRequest(request: AIRequest): ParsedAIRequest {
  const parsed = AIRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new AIProviderError(
      "INVALID_REQUEST",
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
        .join("; "),
    );
  }
  return parsed.data;
}
