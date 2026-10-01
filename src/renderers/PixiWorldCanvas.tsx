"use client";

import React, { useEffect, useRef } from "react";
import { World } from "@/domain/world/world";
import { PixiWorldRenderer } from "@/renderers/pixi/PixiWorldRenderer";

export interface PixiWorldCanvasProps {
  world: World;
  className?: string;
  style?: React.CSSProperties;
}

export const PixiWorldCanvas: React.FC<PixiWorldCanvasProps> = ({
  world,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // 1. Inicialización e Invariante de Ciclo de Vida (Un solo mount)
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    const renderer = new PixiWorldRenderer();
    rendererRef.current = renderer;
    isInitializedRef.current = true;

    let active = true;

    renderer.init(containerRef.current).then(() => {
      if (active && rendererRef.current) {
        rendererRef.current.render(world);
      }
    });

    // Clean up al desmontar el componente React
    return () => {
      active = false;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  // 2. Re-renderizado reactivo ante cambios en la prop 'world' sin reinicializar Pixi
  useEffect(() => {
    if (rendererRef.current && isInitializedRef.current) {
      rendererRef.current.render(world);
    }
  }, [world]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    />
  );
};
