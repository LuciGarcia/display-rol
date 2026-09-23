"use client";

import { useEffect, useRef, useState, use } from "react";
import dynamic from "next/dynamic";
import { MapData, CharacterData } from "@/types/schema";
import { pusherClient } from "@/app/lib/pusher";

const FloorMap = dynamic(() => import("@/components/FloorMap"), { ssr: false });

export default function DisplayView({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    // Suscribirse al canal de tiempo real de esta sesión
    const channel = pusherClient.subscribe(`game-session-${sessionId}`);

    // Evento: Inicialización o actualización del mapa completo
    channel.bind(
      "map-init",
      (data: { map: MapData; characters: CharacterData[] }) => {
        setMapData(data.map);
        setCharacters(data.characters);
      },
    );

    // Evento: Cambio de estado de un área
    channel.bind(
      "area-state-changed",
      ({ areaId, newState }: { areaId: string; newState: string }) => {
        setMapData((prevMap) => {
          if (!prevMap) return null;
          const updatedAreas = prevMap.areas.map((area) =>
            area.id === areaId ? { ...area, currentState: newState } : area,
          );
          return { ...prevMap, areas: updatedAreas };
        });
      },
    );

    // Evento: Movimiento de un personaje
    channel.bind(
      "character-moved",
      ({ charId, x, y }: { charId: string; x: number; y: number }) => {
        setCharacters((prev) =>
          prev.map((c) => (c.id === charId ? { ...c, x, y } : c)),
        );
      },
    );

    return () => {
      pusherClient.unsubscribe(`game-session-${sessionId}`);
    };
  }, [sessionId]);

  if (!mapData) {
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
          {mapData.scenarioName}
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
        <FloorMap mapData={mapData} characters={characters} isMaster={false} />
      </div>
    </div>
  );
}
