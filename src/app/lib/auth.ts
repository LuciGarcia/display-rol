import { createAuthApi } from "@/infrastructure/auth/authApi";
import {
  createRequestGuard,
  type AuthConfig,
} from "@/infrastructure/auth/requestGuard";

// SOLO SERVIDOR (lo importan las rutas /api). Nunca desde componentes ni hooks.
const config: AuthConfig = {
  secret: process.env.AUTH_SECRET,
  masterKey: process.env.MASTER_KEY,
  secureCookie: process.env.NODE_ENV === "production",
  sessionTtlSeconds: 8 * 60 * 60,
  now: () => Date.now(),
};

export const guard = createRequestGuard(config);
export const authApi = createAuthApi(config, guard.authenticate);
