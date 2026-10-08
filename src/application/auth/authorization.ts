// Autorización pura: no sabe de HTTP, cookies, Pusher ni base de datos.
// Responde a una sola pregunta: ¿este actor puede realizar esta operación?

export type Role = "MASTER" | "PLAYER";

/** Quién actúa. Se obtiene siempre en el servidor, nunca de datos enviados por el cliente. */
export interface Actor {
  role: Role;
}

export type Operation =
  | "world:read" // GET /api/worlds/:id  (el Display)
  | "world:list" // GET /api/worlds
  | "world:create"
  | "world:save"
  | "world:delete"
  | "ai:interpret"; // la IA solo propone, pero consume cuota y prepara mutaciones

// Lo único público es leer una partida por su id. Todo lo demás exige MASTER.
// Nota: conocer World.id permite OBSERVAR, nunca modificar.
const PUBLIC_OPERATIONS: ReadonlySet<Operation> = new Set(["world:read"]);

export type AuthDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: "UNAUTHENTICATED" | "FORBIDDEN";
      status: 401 | 403;
      message: string;
    };

export function authorize(
  actor: Actor | null,
  operation: Operation,
): AuthDecision {
  if (PUBLIC_OPERATIONS.has(operation)) return { allowed: true };
  if (!actor) {
    return {
      allowed: false,
      code: "UNAUTHENTICATED",
      status: 401,
      message: "Necesitás iniciar sesión como Master.",
    };
  }
  if (actor.role === "MASTER") return { allowed: true };
  return {
    allowed: false,
    code: "FORBIDDEN",
    status: 403,
    message: "No tenés permiso para modificar la partida.",
  };
}
