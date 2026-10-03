import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProviderError, type AIErrorCode } from "../errors";
import type { AIConfig } from "../config";
import {
  parseAIRequest,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type ParsedAIRequest,
} from "../types";

// Costura mínima con el SDK: permite simular fallos en tests sin red.
export type GoogleTransport = (request: ParsedAIRequest) => Promise<string>;

export function createGoogleTransport(config: AIConfig): GoogleTransport {
  const client = new GoogleGenerativeAI(config.apiKey);
  return async (req) => {
    const model = client.getGenerativeModel(
      {
        model: config.model,
        systemInstruction: req.system,
        generationConfig: {
          responseMimeType:
            req.responseFormat === "json" ? "application/json" : "text/plain",
          temperature: req.temperature,
        },
      },
      { timeout: config.timeoutMs },
    );
    const result = await model.generateContent(req.prompt);
    return result.response.text();
  };
}

interface ErrorInfo {
  status?: number;
  name?: string;
  message: string;
}

function readErrorInfo(error: unknown): ErrorInfo {
  if (typeof error === "object" && error !== null) {
    const e = error as { status?: unknown; name?: unknown; message?: unknown };
    return {
      status: typeof e.status === "number" ? e.status : undefined,
      name: typeof e.name === "string" ? e.name : undefined,
      message: typeof e.message === "string" ? e.message : String(error),
    };
  }
  return { message: String(error) };
}

function classify(info: ErrorInfo): AIErrorCode {
  const { status, name, message } = info;
  if (name === "AbortError" || status === 408 || /timed? ?out/i.test(message))
    return "TIMEOUT";
  if (status === 429) return "RATE_LIMIT";
  if (status === 401 || status === 403) return "CONFIG";
  if (status !== undefined && status >= 500) return "UNAVAILABLE";
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(message))
    return "UNAVAILABLE";
  if (name === "GoogleGenerativeAIResponseError") return "INVALID_RESPONSE";
  return "UNKNOWN";
}

export class GoogleAIProvider implements AIProvider {
  readonly id = "google";

  constructor(
    private readonly config: AIConfig,
    private readonly transport: GoogleTransport = createGoogleTransport(config),
  ) {}

  async generate(input: AIRequest): Promise<AIResponse> {
    const request = parseAIRequest(input);
    let text: string;
    try {
      text = await this.transport(request);
    } catch (error) {
      throw this.toAIError(error);
    }
    if (!text.trim()) {
      throw new AIProviderError(
        "EMPTY_RESPONSE",
        "El proveedor devolvió una respuesta vacía",
        {
          providerId: this.id,
        },
      );
    }
    return { text, providerId: this.id, model: this.config.model };
  }

  private toAIError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) return error;
    const info = readErrorInfo(error);
    const safeMessage = info.message
      .split(this.config.apiKey)
      .join("[REDACTED]");
    return new AIProviderError(
      classify(info),
      `Error del proveedor de IA: ${safeMessage}`,
      {
        providerId: this.id,
        status: info.status,
      },
    );
  }
}
