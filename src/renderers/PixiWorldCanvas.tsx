"use client";

import React, { useEffect, useRef } from "react";
import { World } from "../domain/world/world";
import { PixiWorldRenderer } from "../renderers/pixi/PixiWorldRenderer";

interface PixiWorldCanvasProps {
  world: World;
}

export const PixiWorldCanvas: React.FC<PixiWorldCanvasProps> = ({ world }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiWorldRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new PixiWorldRenderer();
    rendererRef.current = renderer;

    let isMounted = true;

    renderer.init(containerRef.current).then(() => {
      if (isMounted) {
        renderer.render(world);
      }
    });

    return () => {
      isMounted = false;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(world);
    }
  }, [world]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    />
  );
};
