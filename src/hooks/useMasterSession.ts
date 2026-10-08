"use client";

import { useCallback, useEffect, useState } from "react";

export type MasterSessionState = "checking" | "master" | "anonymous";

// Solo refleja lo que el servidor ya decidió. Ocultar la UI no es seguridad:
// cada operación sensible vuelve a autorizarse en el servidor.
export function useMasterSession() {
  const [state, setState] = useState<MasterSessionState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data: { role?: string | null }) => {
        if (active) setState(data?.role === "MASTER" ? "master" : "anonymous");
      })
      .catch(() => {
        if (active) setState("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (key: string) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) return setState("master");
      setError(
        res.status === 503
          ? "El servidor no tiene configurada la autenticación."
          : "Clave incorrecta.",
      );
    } catch {
      setError("No se pudo contactar al servidor.");
    }
  }, []);

  return { state, error, login };
}
