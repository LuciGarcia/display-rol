"use client";

import React, { useEffect, useRef, useState } from "react";
import { World } from "@/domain/world/world";
import { PixiWorldRenderer } from "@/renderers/pixi/PixiWorldRenderer";

export interface PixiWorldCanvasProps {
  world: World;
  className?: string;
  style?: React.CSSProperties;
  onAreaSelected?: (areaId: string | null) => void;
}

export const PixiWorldCanvas: React.FC<PixiWorldCanvasProps> = ({
  world,
  className,
  style,
  onAreaSelected,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0); //Distancia acumulada del Arrastre
  const lastPointerPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    const renderer = new PixiWorldRenderer();
    rendererRef.current = renderer;
    isInitializedRef.current = true;

    let active = true;

    renderer.init(containerRef.current).then(() => {
      if (active && rendererRef.current) {
        renderer.setOnAreaSelectedListener((areaId) => {
          if (dragDistanceRef.current > 5) return;
          setSelectedAreaId(areaId);
          onAreaSelected?.(areaId);
        });

        renderer.render(world);
      }
    });

    return () => {
      active = false;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  // Re-renderizado cuando cambia el World o la selección
  useEffect(() => {
    if (rendererRef.current && isInitializedRef.current) {
      rendererRef.current.setSelectedArea(selectedAreaId);
      rendererRef.current.render(world);
    }
  }, [world, selectedAreaId]);

  // Manejo de eventos de entrada para la cámara (Pan y Zoom)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Click primario
    isDraggingRef.current = true;
    dragDistanceRef.current = 0; // Reiniciar distancia de arrastre
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !rendererRef.current) return;

    const dx = e.clientX - lastPointerPos.current.x;
    const dy = e.clientY - lastPointerPos.current.y;

    dragDistanceRef.current += Math.abs(dx) + Math.abs(dy); // Acumular distancia de arrastre
    lastPointerPos.current = { x: e.clientX, y: e.clientY };

    const camera = rendererRef.current.getCamera();
    camera?.pan(dx, dy);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!rendererRef.current || !containerRef.current) return;

    const camera = rendererRef.current.getCamera();
    if (!camera) return;

    const rect = containerRef.current.getBoundingClientRect();
    const focusX = e.clientX - rect.left;
    const focusY = e.clientY - rect.top;

    const currentZoom = camera.getZoom();
    const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
    camera.setZoom(currentZoom * zoomDelta, focusX, focusY);
  };

  const handleZoomIn = () => {
    const camera = rendererRef.current?.getCamera();
    if (camera) camera.setZoom(camera.getZoom() * 1.2);
  };

  const handleZoomOut = () => {
    const camera = rendererRef.current?.getCamera();
    if (camera) camera.setZoom(camera.getZoom() / 1.2);
  };

  const handleResetCamera = () => {
    const camera = rendererRef.current?.getCamera();
    if (camera) camera.resetPosition();
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
        cursor: isDraggingRef.current ? "grabbing" : "grab",
        userSelect: "none",
        ...style,
      }}
    >
      {/* Controles de UI para Cámara [ − ] [ Reset ] [ + ] */}
      <div
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
