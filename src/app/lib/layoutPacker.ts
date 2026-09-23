// src/lib/layoutPacker.ts

import { CATALOG_BY_ID } from "./assetsCatalog";

export interface PlacedObstacle {
  id: string;
  assetId: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  rotation: number;
  color: string;
}

const MARGIN = 8; // separación entre objetos y con el borde del área

export function packAreaFurniture(
  area: {
    id: string;
    bounds: { x: number; y: number; width: number; height: number };
    currentState: string;
  },
  furnitureRequest: { assetId: string; quantity: number }[],
  chaotic: boolean,
): PlacedObstacle[] {
  const items: PlacedObstacle[] = [];
  const { x: areaX, y: areaY, width: areaW, height: areaH } = area.bounds;

  // Expandir quantity a items individuales
  const flatItems = furnitureRequest.flatMap((req) => {
    const asset = CATALOG_BY_ID[req.assetId];
    if (!asset) return [];
    return Array.from({ length: req.quantity }, (_, i) => ({
      asset,
      index: i,
    }));
  });

  // Grid simple: cuántas columnas entran según el ancho promedio de los assets
  const avgWidth = flatItems.length
    ? flatItems.reduce((s, it) => s + it.asset.defaultWidth, 0) /
      flatItems.length
    : 60;
  const cols = Math.max(1, Math.floor((areaW - MARGIN) / (avgWidth + MARGIN)));

  flatItems.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const cellW = (areaW - MARGIN) / cols;
    const cellH = item.asset.defaultHeight + MARGIN * 2;

    let x = areaX + MARGIN + col * cellW;
    let y = areaY + MARGIN + row * cellH;

    // Clamp DURO: pase lo que pase, nunca sale del área
    const w = Math.min(item.asset.defaultWidth, cellW - MARGIN);
    const h = Math.min(item.asset.defaultHeight, areaH - MARGIN * 2);
    x = Math.min(Math.max(x, areaX), areaX + areaW - w);
    y = Math.min(Math.max(y, areaY), areaY + areaH - h);

    // Si el área está "caótica", desordenar un poco sin romper el clamp
    const jitterX = chaotic ? (Math.random() - 0.5) * 20 : 0;
    const jitterY = chaotic ? (Math.random() - 0.5) * 20 : 0;
    const rotation = chaotic ? Math.floor(Math.random() * 360) : 0;

    items.push({
      id: `${area.id}-obs-${i}`,
      assetId: item.asset.assetId,
      name: item.asset.name,
      bounds: {
        x: Math.min(Math.max(x + jitterX, areaX), areaX + areaW - w),
        y: Math.min(Math.max(y + jitterY, areaY), areaY + areaH - h),
        width: w,
        height: h,
      },
      rotation,
      color: "#8B5E34",
    });
  });

  return items;
}
