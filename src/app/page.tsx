"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [worldId, setWorldId] = useState("");
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white font-sans p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-extrabold text-blue-500 mb-3">
          Generador de Planos & Simulador IA
        </h1>
        <p className="text-neutral-400 mb-8 text-sm">
          Sistema dinámico e interactivo de simulación para organizaciones,
          plantas industriales y escenarios adaptables.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/master"
            className="p-6 bg-neutral-900 border border-neutral-800 hover:border-blue-500 rounded-xl shadow-lg transition-all text-left group"
          >
            <span className="text-3xl mb-2 block">🎯</span>
            <h2 className="font-bold text-lg text-white group-hover:text-blue-400">
              Panel del Master
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Configura escenarios con IA, gestiona roles y controla áreas en
              tiempo real.
            </p>
          </Link>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = worldId.trim();
              if (id) router.push(`/display/${encodeURIComponent(id)}`);
            }}
            className="p-6 bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg text-left"
          >
            <span className="text-3xl mb-2 block">📺</span>
            <h2 className="font-bold text-lg text-white">Vista Display</h2>
            <p className="text-xs text-neutral-400 mt-1 mb-3">
              Pantalla de solo lectura. Usa el enlace que te da el Master o
              escribe el identificador de la partida.
            </p>
            <input
              value={worldId}
              onChange={(e) => setWorldId(e.target.value)}
              placeholder="Identificador de la partida"
              aria-label="Identificador de la partida"
              className="w-full px-3 py-2 mb-2 bg-neutral-950 border border-neutral-700 rounded text-sm"
            />
            <button
              type="submit"
              disabled={!worldId.trim()}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded text-sm"
            >
              Abrir Display
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
