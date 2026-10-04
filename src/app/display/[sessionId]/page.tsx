"use client";

import { useEffect, useRef, useState, use } from "react";
import { WorldSchema, type World } from "@/domain/world/world";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";
import { pusherClient } from "@/app/lib/pusher";

// El Display solo visualiza: recibe un snapshot del World y lo muestra con el mismo
// pipeline que el Master (Layout → Assets → Pixi). Nunca modifica el mundo.
const WORLD_SNAPSHOT_EVENT = "world-snapshot";

export default function DisplayView({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const containerRef = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<World | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const channel = pusherClient.subscribe(`game-session-${sessionId}`);

    // Frontera: lo que llega por la red es dato no confiable, se valida con Zod
    channel.bind(WORLD_SNAPSHOT_EVENT, (data: unknown) => {
      const parsed = WorldSchema.safeParse(data);
      if (parsed.success) setWorld(parsed.data);
      else console.error("Snapshot de World inválido:", parsed.error.issues);
    });

    return () => {
      pusherClient.unsubscribe(`game-session-${sessionId}`);
    };
  }, [sessionId]);

  if (!world) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white font-sans p-6 text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold">
          Esperando que el Master inicie la partida...
        </h2>
        <p className="text-sm text-neutral-500 mt-2">Sesión ID: {sessionId}</p>
      </div>
    );
  }

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
          <span className="bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            EN VIVO (DISPLAY)
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
