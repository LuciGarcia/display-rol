import {
  SESSION_COOKIE,
  validMasterKey,
  validSecret,
  type AuthConfig,
} from "./requestGuard";
import { safeEqual, signSession } from "./sessionToken";
import type { Actor } from "../../application/auth/authorization";

// Único punto donde se emite una credencial de Master. Sin usuarios ni registro:
// la clave del Master vive en el servidor (MASTER_KEY).
export function createAuthApi(
  config: AuthConfig,
  authenticate: (request: Request) => Actor | null,
) {
  const cookie = (value: string, maxAge: number) =>
    [
      `${SESSION_COOKIE}=${value}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${maxAge}`,
      ...(config.secureCookie ? ["Secure"] : []),
    ].join("; ");

  const fail = (code: string, message: string, status: number) =>
    Response.json({ code, message }, { status });

  return {
    async login(request: Request): Promise<Response> {
      const secret = validSecret(config);
      const masterKey = validMasterKey(config);
      if (!secret || !masterKey) {
        return fail(
          "AUTH_NOT_CONFIGURED",
          "La autenticación no está configurada en el servidor.",
          503,
        );
      }
      let key: unknown;
      try {
        key = (await request.json())?.key;
      } catch {
        key = undefined;
      }
      if (typeof key !== "string" || !safeEqual(key, masterKey)) {
        return fail("UNAUTHENTICATED", "Clave incorrecta.", 401);
      }
      const token = signSession(
        { role: "MASTER" },
        secret,
        config.sessionTtlSeconds,
        config.now(),
      );
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": cookie(token, config.sessionTtlSeconds) },
      });
    },

    logout(): Response {
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": cookie("", 0) },
      });
    },

    session(request: Request): Response {
      return Response.json({ role: authenticate(request)?.role ?? null });
    },
  };
}
