export type AIErrorCode =
  | "CONFIG"
  | "INVALID_REQUEST"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "EMPTY_RESPONSE"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

const RETRYABLE: ReadonlySet<AIErrorCode> = new Set([
  "UNAVAILABLE",
  "TIMEOUT",
  "RATE_LIMIT",
]);

// No guarda el error original (podría contener la key): solo código, mensaje ya saneado y status HTTP.
export class AIProviderError extends Error {
  readonly code: AIErrorCode;
  readonly providerId?: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: AIErrorCode,
    message: string,
    options: { providerId?: string; status?: number } = {},
  ) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.providerId = options.providerId;
    this.status = options.status;
    this.retryable = RETRYABLE.has(code);
  }
}
