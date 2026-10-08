import { NextResponse } from "next/server";
import { createAIProvider } from "@/ai/createAIProvider";
import { AIProviderError, type AIErrorCode } from "@/ai/errors";
import { AIProposalError } from "@/application/ai/errors";
import { interpretInstruction } from "@/application/ai/interpretInstruction";
import {
  InterpretRequestSchema,
  type InterpretResponse,
} from "@/application/ai/proposal";
import { guard } from "@/app/lib/auth";

export const runtime = "nodejs";

const STATUS_BY_CODE: Record<AIErrorCode, number> = {
  CONFIG: 500,
  INVALID_REQUEST: 400,
  UNAVAILABLE: 503,
  TIMEOUT: 504,
  RATE_LIMIT: 429,
  EMPTY_RESPONSE: 502,
  INVALID_RESPONSE: 502,
  UNKNOWN: 502,
};

const fail = (
  status: number,
  kind: "request" | "provider" | "parse" | "proposal" | "unknown",
  code: string,
  message: string,
) =>
  NextResponse.json<InterpretResponse>(
    { ok: false, kind, code, message },
    { status },
  );

async function interpret(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(
      400,
      "request",
      "INVALID_JSON",
      "El cuerpo de la petición no es JSON válido.",
    );
  }

  const parsed = InterpretRequestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "petición"}: ${i.message}`)
      .join("; ");
    return fail(
      400,
      "request",
      "INVALID_REQUEST",
      `Petición inválida (${detail}).`,
    );
  }

  try {
    const provider = createAIProvider(); // falta de API key → AIProviderError CONFIG
    const proposal = await interpretInstruction({ provider, ...parsed.data });
    return NextResponse.json<InterpretResponse>({ ok: true, proposal });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return fail(
        STATUS_BY_CODE[error.code],
        "provider",
        error.code,
        error.message,
      );
    }
    if (error instanceof AIProposalError) {
      return fail(
        422,
        error.kind === "PARSE" ? "parse" : "proposal",
        error.kind,
        error.message,
      );
    }
    console.error(
      "Error inesperado en /api/ai/interpret:",
      error instanceof Error ? error.name : "desconocido",
    );
    return fail(500, "unknown", "UNKNOWN", "Error interno inesperado.");
  }
}

// Solo el Master puede pedir propuestas a la IA
export const POST = guard.protect("ai:interpret", interpret);
