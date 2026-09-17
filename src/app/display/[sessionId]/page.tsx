"use client";

import { useEffect, useState, use } from "react";
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
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);

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
    <div className="p-6 bg-neutral-950 min-h-screen text-white font-sans flex flex-col items-center justify-center">
      <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-400">
          {mapData.scenarioName}
        </h1>
        <span className="bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          EN VIVO (DISPLAY)
        </span>
      </div>

      {/* Renderizado de Solo Lectura (isMaster = false) */}
      <FloorMap mapData={mapData} characters={characters} isMaster={false} />
    </div>
  );
}
