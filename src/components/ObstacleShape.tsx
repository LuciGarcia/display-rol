// src/components/ObstacleShape.tsx
import { Image as KonvaImage } from "react-konva";
import { useImage } from "react-konva-utils"; // o tu propio hook con Konva.Image.fromURL
import { CATALOG_BY_ID } from "@/app/lib/assetsCatalog";
import type { PlacedObstacle } from "@/app/lib/layoutPacker";

export function ObstacleShape({ obstacle }: { obstacle: PlacedObstacle }) {
  const asset = CATALOG_BY_ID[obstacle.assetId];
  const [image] = useImage(asset?.imageUrl ?? "");

  if (!image) return null; // o un Rect de fallback mientras carga

  return (
    <KonvaImage
      image={image}
      x={obstacle.bounds.x + obstacle.bounds.width / 2}
      y={obstacle.bounds.y + obstacle.bounds.height / 2}
      width={obstacle.bounds.width}
      height={obstacle.bounds.height}
      offsetX={obstacle.bounds.width / 2}
      offsetY={obstacle.bounds.height / 2}
      rotation={obstacle.rotation}
    />
  );
}
