export type AIProposalErrorKind = "PARSE" | "VALIDATION";

// Error de la frontera IA → propuesta (ni del proveedor ni del dominio).
export class AIProposalError extends Error {
  readonly kind: AIProposalErrorKind;
  constructor(kind: AIProposalErrorKind, message: string) {
    super(message);
    this.name = "AIProposalError";
    this.kind = kind;
  }
}
