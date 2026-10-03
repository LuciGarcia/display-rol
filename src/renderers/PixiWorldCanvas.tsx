"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { World } from "@/domain/world/world";
import { PixiWorldRenderer } from "@/renderers/pixi/PixiWorldRenderer";
import { LayoutEngine } from "@/engine/layout/LayoutEngine";

const layoutEngine = new LayoutEngine();

export interface PixiWorldCanvasProps {
  world: World;
  className?: string;
  style?: React.CSSProperties;
  onAreaSelected?: (areaId: string | null) => void;
}

// Desplazamiento mínimo (px, desde el pointerdown) para considerar que es un drag
const DRAG_THRESHOLD = 5;

export const PixiWorldCanvas: React.FC<PixiWorldCanvasProps> = ({
  world,
  className,
  style,
  onAreaSelected,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);

  // Pixi terminó de inicializar: recién ahí se puede renderizar
  const [ready, setReady] = useState(false);
  // Selección visual: estado de UI, nunca del dominio
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  // Estado (no ref) para que el cursor sí se actualice durante el pan
  const [isPanning, setIsPanning] = useState(false);

  // Siempre apunta al callback más reciente (evita closures viejos)
  const onAreaSelectedRef = useRef(onAreaSelected);
  useEffect(() => {
    onAreaSelectedRef.current = onAreaSelected;
  }, [onAreaSelected]);

  const isPointerDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const dragDistanceRef = useRef(0); // máximo desplazamiento desde el pointerdown
  const startPos = useRef({ x: 0, y: 0 });
  const lastPointerPos = useRef({ x: 0, y: 0 });

  // Inicialización de Pixi (una sola vez)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new PixiWorldRenderer();
    rendererRef.current = renderer;
    let active = true;

    const initPromise = renderer.init(container);

    initPromise
      .then(() => {
        if (!active) return;
        renderer.setOnAreaSelectedListener((areaId) => {
          // Si el puntero se movió más que el umbral, fue un drag, no un click
          if (dragDistanceRef.current > DRAG_THRESHOLD) return;
          setSelectedAreaId(areaId);
          onAreaSelectedRef.current?.(areaId);
        });
        setReady(true);
      })
      .catch((error) => {
        console.error("Error inicializando PixiWorldRenderer:", error);
      });

    return () => {
      active = false;
      rendererRef.current = null;
      setReady(false);
      // Se destruye recién cuando init() terminó (evita errores en StrictMode)
      initPromise.then(() => renderer.destroy()).catch(() => {});
    };
  }, []);

  // Modificación solicitada: cálculo memoizado del layout y efecto de render actualizado
  const layout = useMemo(() => {
    try {
      return layoutEngine.compute(world);
    } catch (error) {
      console.error("Error calculando el layout:", error);
      return null;
    }
  }, [world]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!ready || !renderer || !layout) return;
    renderer.setSelectedArea(selectedAreaId);
    renderer.render(world, layout);
  }, [ready, world, layout, selectedAreaId]);

  // --- Pan: click vs drag ---

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isPointerDownRef.current = true;
    isPanningRef.current = false;
    dragDistanceRef.current = 0;
    startPos.current = { x: e.clientX, y: e.clientY };
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || !rendererRef.current) return;

    const total = Math.hypot(
      e.clientX - startPos.current.x,
      e.clientY - startPos.current.y,
    );
    dragDistanceRef.current = Math.max(dragDistanceRef.current, total);

    // Todavía es un click: no mover la cámara
    if (!isPanningRef.current && total < DRAG_THRESHOLD) return;

    if (!isPanningRef.current) {
      isPanningRef.current = true;
      setIsPanning(true);
    }

    const dx = e.clientX - lastPointerPos.current.x;
    const dy = e.clientY - lastPointerPos.current.y;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    rendererRef.current.getCamera()?.pan(dx, dy);
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    isPanningRef.current = false;
    setIsPanning(false);
    // dragDistanceRef NO se resetea acá: el pointertap de Pixi lo consulta después
  };

  // --- Zoom ---

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!rendererRef.current || !containerRef.current) return;

    const camera = rendererRef.current.getCamera();
    if (!camera) return;

    const rect = containerRef.current.getBoundingClientRect();
    const focusX = e.clientX - rect.left;
    const focusY = e.clientY - rect.top;

    const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
    camera.setZoom(camera.getZoom() * zoomDelta, focusX, focusY);
  };

  // Zoom de los botones: hacia el centro del contenedor
  const zoomBy = (factor: number) => {
    const camera = rendererRef.current?.getCamera();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!camera || !rect) return;
    camera.setZoom(camera.getZoom() * factor, rect.width / 2, rect.height / 2);
  };

  const handleZoomIn = () => zoomBy(1.2);
  const handleZoomOut = () => zoomBy(1 / 1.2);

  const handleResetCamera = () => {
    rendererRef.current?.getCamera()?.resetPosition();
  };

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        cursor: isPanning ? "grabbing" : "grab",
        userSelect: "none",
        ...style,
      }}
    >
      {/* Controles de cámara [ − ] [ Reset ] [ + ] */}
      <div
        // Evita que clickear los botones inicie un pan en el contenedor
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          display: "flex",
          gap: "8px",
          zIndex: 10,
          background: "rgba(15, 23, 42, 0.75)",
          padding: "8px",
          borderRadius: "8px",
          backdropFilter: "blur(4px)",
        }}
      >
        <button
          onClick={handleZoomOut}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "4px",
            border: "none",
            background: "#334155",
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
          }}
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleResetCamera}
          style={{
            padding: "0 12px",
            height: "32px",
            borderRadius: "4px",
            border: "none",
            background: "#334155",
            color: "#fff",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
          title="Reset Camera"
        >
          Reset
        </button>
        <button
          onClick={handleZoomIn}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "4px",
            border: "none",
            background: "#334155",
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
          }}
          title="Zoom In"
        >
          +
        </button>
      </div>
    </div>
  );
};
