import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Actor } from "../../application/auth/authorization";

// Token de sesión firmado (HMAC-SHA256): `v1.<payload>.<firma>`.
// Sin dependencias. Sustituible por un sistema de usuarios completo sin tocar el dominio:
// solo cambia cómo se obtiene el Actor.

export const MIN_SECRET_LENGTH = 32;
const VERSION = "v1";

const PayloadSchema = z.object({
  role: z.enum(["MASTER", "PLAYER"]),
  exp: z.number().int(), // segundos desde epoch
});

const encode = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");
const mac = (data: string, secret: string) =>
  createHmac("sha256", secret).update(data).digest();

export function signSession(
  actor: Actor,
  secret: string,
  ttlSeconds: number,
  nowMs: number,
): string {
  const payload = encode(
    JSON.stringify({
      role: actor.role,
      exp: Math.floor(nowMs / 1000) + ttlSeconds,
    }),
  );
  const body = `${VERSION}.${payload}`;
  return `${body}.${encode(mac(body, secret))}`;
}

/** Devuelve el Actor solo si la firma es válida y el token no venció; si no, null. */
export function verifySession(
  token: string,
  secret: string,
  nowMs: number,
): Actor | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const expected = mac(`${parts[0]}.${parts[1]}`, secret);
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const parsed = PayloadSchema.safeParse(
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
    );
    if (!parsed.success || parsed.data.exp <= Math.floor(nowMs / 1000)) {
      return null;
    }
    return { role: parsed.data.role };
  } catch {
    return null;
  }
}

/** Comparación en tiempo constante (compara digests, así no depende de la longitud). */
export function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
