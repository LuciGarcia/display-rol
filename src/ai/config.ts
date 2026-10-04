import { z } from "zod";
import { AIProviderError } from "./errors";

// Mismos nombres de variable que ya usaba el proyecto: no hace falta cambiar tu .env.local.
export const DEFAULT_GOOGLE_MODEL = "gemini-3-flash-preview"; // confirmar con el smoke test
export const DEFAULT_TIMEOUT_MS = 30_000;

const AIConfigSchema = z.object({
  provider: z.literal("google"), // al sumar proveedores esto pasa a discriminatedUnion
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1),
  timeoutMs: z.number().int().positive().max(120_000),
});
export type AIConfig = z.infer<typeof AIConfigSchema>;

export type Env = Readonly<Record<string, string | undefined>>;

// Pura: recibe el entorno por parámetro, así se testea sin tocar process.env.
export function loadAIConfig(env: Env): AIConfig {
  const parsed = AIConfigSchema.safeParse({
    provider: env.AI_PROVIDER || "google",
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY,
    model: env.AI_MODEL || DEFAULT_GOOGLE_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS
      ? Number(env.AI_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS,
  });
  if (!parsed.success) {
    // Los mensajes de Zod nunca incluyen el valor de la key.
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new AIProviderError(
      "CONFIG",
      `Configuración de IA inválida (${detail})`,
    );
  }
  return parsed.data;
}
