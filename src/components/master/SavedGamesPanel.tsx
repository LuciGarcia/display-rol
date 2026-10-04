"use client";

import type { WorldSummary } from "@/application/persistence/WorldRepository";

interface Props {
  games: WorldSummary[];
  error: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SavedGamesPanel({ games, error, onLoad, onDelete }: Props) {
  if (games.length === 0 && !error) return null;

  return (
    <div className="max-w-4xl mx-auto mt-4 p-6 bg-neutral-800 rounded-xl border border-neutral-700 space-y-3">
      <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider">
        Partidas guardadas
      </h3>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <ul className="space-y-2">
        {games.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between gap-3 p-3 bg-neutral-900 border border-neutral-700 rounded text-sm"
          >
            <div>
              <span className="font-semibold text-neutral-100">{g.name}</span>
              <span className="ml-2 text-xs text-neutral-500">
                {new Date(g.updatedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onLoad(g.id)}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold"
              >
                Cargar
              </button>
              <button
                onClick={() => onDelete(g.id)}
                className="px-3 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 rounded text-xs"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
