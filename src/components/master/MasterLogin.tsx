"use client";

import { useState, type FormEvent } from "react";

interface Props {
  onLogin: (key: string) => Promise<void>;
  error: string | null;
}

export function MasterLogin({ onLogin, error }: Props) {
  const [key, setKey] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (key) await onLogin(key);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-6 text-white font-sans">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-950 p-6"
      >
        <h1 className="text-xl font-bold text-blue-400">Acceso del Master</h1>
        <p className="text-sm text-neutral-400">
          Ingresá la clave de Master para crear y modificar partidas.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          placeholder="Clave de Master"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold hover:bg-blue-600"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
