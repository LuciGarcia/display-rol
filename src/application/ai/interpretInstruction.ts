import type { AIProvider } from "../../ai/types";
import { AIProposalError } from "./errors";
import { AIProposalSchema, type AIProposal } from "./proposal";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type InterpretMode,
} from "./prompt";
import type { WorldContext } from "./worldContext";

function stripCodeFence(text: string): string {
  const t = text.trim();
  const match = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : t;
}

// Frontera: texto de la IA → propuesta validada. La respuesta se trata siempre como datos.
export function parseProposalText(text: string): AIProposal {
  let data: unknown;
  try {
    data = JSON.parse(stripCodeFence(text));
  } catch {
    throw new AIProposalError(
      "PARSE",
      "La respuesta de la IA no es JSON válido.",
    );
  }
  const parsed = AIProposalSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "propuesta"}: ${i.message}`)
      .join("; ");
    throw new AIProposalError("VALIDATION", `Propuesta inválida (${detail}).`);
  }
  return parsed.data;
}

export async function interpretInstruction(params: {
  provider: AIProvider;
  instruction: string;
  context: WorldContext;
  mode: InterpretMode;
}): Promise<AIProposal> {
  const { provider, instruction, context, mode } = params;
  const response = await provider.generate({
    system: buildSystemPrompt(mode),
    prompt: buildUserPrompt(instruction, context, mode),
    responseFormat: "json",
    temperature: 0,
  });
  const proposal = parseProposalText(response.text);
  if (mode === "generate" && proposal.status === "ok" && !proposal.world) {
    throw new AIProposalError(
      "VALIDATION",
      "Propuesta inválida (world: falta el nombre y tipo del mundo).",
    );
  }
  return proposal;
}
