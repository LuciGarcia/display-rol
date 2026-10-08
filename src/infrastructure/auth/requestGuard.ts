import {
  authorize,
  type Actor,
  type Operation,
} from "../../application/auth/authorization";
import { MIN_SECRET_LENGTH, verifySession } from "./sessionToken";

export const SESSION_COOKIE = "display_rol_session";
export const MIN_MASTER_KEY_LENGTH = 12;

export interface AuthConfig {
  /** Firma las sesiones. Solo servidor. */
  secret: string | undefined;
  /** Clave que escribe el Master para iniciar sesión. Solo servidor. */
  masterKey: string | undefined;
  secureCookie: boolean;
  sessionTtlSeconds: number;
  now: () => number;
}

// Sin configuración válida el sistema "falla cerrado": nadie se autentica.
export const validSecret = (config: AuthConfig): string | null =>
  config.secret && config.secret.length >= MIN_SECRET_LENGTH
    ? config.secret
    : null;

export const validMasterKey = (config: AuthConfig): string | null =>
  config.masterKey && config.masterKey.length >= MIN_MASTER_KEY_LENGTH
    ? config.masterKey
    : null;

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return null;
}

// Frontera de confianza HTTP: Request → Actor → decisión → handler.
// Un rechazo ocurre ANTES de leer el cuerpo o tocar la persistencia.
export function createRequestGuard(config: AuthConfig) {
  const authenticate = (request: Request): Actor | null => {
    const secret = validSecret(config);
    if (!secret) return null;
    const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
    return token ? verifySession(token, secret, config.now()) : null;
  };

  const protect =
    <A extends unknown[]>(
      operation: Operation,
      handler: (request: Request, ...args: A) => Response | Promise<Response>,
    ) =>
    async (request: Request, ...args: A): Promise<Response> => {
      const decision = authorize(authenticate(request), operation);
      if (!decision.allowed) {
        return Response.json(
          { code: decision.code, message: decision.message },
          { status: decision.status },
        );
      }
      return handler(request, ...args);
    };

  return { authenticate, protect };
}
