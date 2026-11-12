"use client";

import { useRef } from "react";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";
import { useWorldSync } from "@/hooks/useWorldSync";
import { useActiveWorldId } from "@/hooks/useActiveWorldId";
import {
  activeWorldSource,
  worldReader,
  worldSubscriber,
} from "@/app/lib/realtime";

// Única pantalla de Display. Solo visualiza la partida ACTIVA (la que el Master tiene abierta,
// nueva o continuada) y cambia sola cuando el Master abre otra. Carga el World persistido,
// escucha WORLD_UPDATED y lo muestra con el mismo pipeline que el Master
// (Layout → Assets → Pixi). Nunca modifica el mundo.
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
    label: "SIN CONEXIÓN EN VIVO: ACTUALIZANDO CADA POCOS SEGUNDOS",
    classes: "bg-red-950 border-red-800 text-red-400",
    dot: "bg-red-400",
  },
} as const;

function Message({
  title,
  detail,
  spinner,
}: {
  title: string;
  detail: string;
  spinner: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white font-sans p-6 text-center">
      {spinner && (
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      )}
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-neutral-400 mt-2">{detail}</p>
    </div>
  );
}

function ActiveDisplay({ worldId }: { worldId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { world, status, phase } = useWorldSync({
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
    return phase === "error" || phase === "not-found" ? (
      <Message
        title="No se pudo cargar la partida"
        detail="Reintentando automáticamente. Si persiste, avisa al Master."
        spinner={false}
      />
    ) : (
      <Message
        title="Cargando la partida..."
        detail="Conectando con el servidor."
        spinner
      />
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
            type="button"
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

export default function DisplayPage() {
  const { worldId, phase } = useActiveWorldId({ source: activeWorldSource });

  if (worldId) return <ActiveDisplay key={worldId} worldId={worldId} />;
  if (phase === "error") {
    return (
      <Message
        title="No se pudo consultar la partida activa"
        detail="Reintentando automáticamente. Si persiste, avisa al Master."
        spinner={false}
      />
    );
  }
  if (phase === "none") {
    return (
      <Message
        title="Esperando al Master"
        detail="Se mostrará sola cuando el Master inicie o continúe una partida."
        spinner
      />
    );
  }
  return (
    <Message
      title="Buscando la partida activa..."
      detail="Conectando con el servidor."
      spinner
    />
  );
}
