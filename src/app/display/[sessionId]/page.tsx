"use client";

import { useRef, use } from "react";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";
import { useWorldSync } from "@/hooks/useWorldSync";
import { worldReader, worldSubscriber } from "@/app/lib/realtime";

// El Display solo visualiza: carga el World persistido, escucha WORLD_UPDATED y lo muestra con
// el mismo pipeline que el Master (Layout → Assets → Pixi). Nunca modifica el mundo.
// El parámetro de la URL es el World.id (identidad canónica de la partida).
const STATUS_BADGE = {
  connected: {
    label: "EN VIVO (DISPLAY)",
    classes: "bg-emerald-950 border-emerald-800 text-emerald-400",
    dot: "bg-emerald-400 animate-pulse",
  },
  connecting: {
    label: "CONECTANDO...",
    classes: "bg-amber-950 border-amber-800 text-amber-400",
    dot: "bg-amber-400 animate-pulse",
  },
  disconnected: {
    label: "SIN CONEXIÓN EN VIVO",
    classes: "bg-red-950 border-red-800 text-red-400",
    dot: "bg-red-400",
  },
} as const;

export default function DisplayView({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId: worldId } = use(params);
  const containerRef = useRef<HTMLDivElement>(null);
  const { world, status } = useWorldSync({
    worldId,
    subscriber: worldSubscriber,
    reader: worldReader,
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (!world) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white font-sans p-6 text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold">
          Esperando que el Master inicie la partida...
        </h2>
        <p className="text-sm text-neutral-500 mt-2">Partida: {worldId}</p>
      </div>
    );
  }

  const badge = STATUS_BADGE[status];
  return (
    <div
      ref={containerRef}
      className="p-4 bg-neutral-950 h-screen text-white font-sans flex flex-col"
    >
      <div className="w-full flex justify-between items-center mb-2 shrink-0">
        <h1 className="text-2xl font-bold text-blue-400">
          {world.metadata.name}
        </h1>
        <div className="flex items-center gap-3">
          <span
            className={`border text-xs px-3 py-1 rounded-full font-bold flex items-center gap-2 ${badge.classes}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
            {badge.label}
          </span>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-sm"
          >
            Pantalla completa
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        <PixiWorldCanvas world={world} />
      </div>
    </div>
  );
}
