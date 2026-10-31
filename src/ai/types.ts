/**
  Contratos y validación de solicitudes y respuestas del módulo de IA.
 
  Define AIRequest, AIResponse y AIProvider, que establecen una interfaz
  independiente del proveedor concreto de inteligencia artificial.
 
 Responsabilidades:
  - Definir y validar la estructura de las solicitudes mediante Zod.
  - Normalizar los datos de entrada antes de enviarlos al proveedor.
  - Establecer el contrato común para generar respuestas de IA.
  - Transformar las solicitudes inválidas en errores AIProviderError.
 
 Se utiliza en:
 - Los proveedores concretos, como GoogleAIProvider.
 - El proveedor simulado FakeAIProvider y las pruebas automatizadas.
 - El punto de creación del proveedor AIProvider.

 Límite arquitectónico:
 No depende de SDK específicos ni del dominio, WorldEngine o renderer.
 */

import { z } from "zod";
import { AIProviderError } from "./errors";

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
