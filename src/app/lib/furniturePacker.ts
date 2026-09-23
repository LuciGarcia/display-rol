// src/lib/furniturePacker.ts

import { CATALOG_BY_ID } from "@/app/lib/assetsCatalog";

interface PlacedObstacle {
  id: string;
  assetId: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  rotation: number;
  color: string;
}

const MARGIN = 20;
const LABEL_RESERVED_HEIGHT = 34;

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
  const { x: areaX, width: areaW, height: areaH } = area.bounds;
  const areaY = area.bounds.y + LABEL_RESERVED_HEIGHT;
  const usableHeight = areaH - LABEL_RESERVED_HEIGHT;

  const flatItems = furnitureRequest.flatMap((req) => {
    const asset = CATALOG_BY_ID[req.assetId];
    if (!asset) return [];
    return Array.from({ length: req.quantity }, () => asset);
  });

  const avgWidth = flatItems.length
    ? flatItems.reduce((s, a) => s + a.defaultWidth, 0) / flatItems.length
    : 60;
  const cols = Math.max(1, Math.floor((areaW - MARGIN) / (avgWidth + MARGIN)));

  flatItems.forEach((asset, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellW = (areaW - MARGIN) / cols;

    let x = areaX + MARGIN + col * cellW;
    let y = areaY + MARGIN + row * (asset.defaultHeight + MARGIN * 2);

    const w = Math.min(asset.defaultWidth, cellW - MARGIN);
    const h = Math.min(asset.defaultHeight, usableHeight - MARGIN * 2);
    // Clamp duro: nunca sale del área, pase lo que pase
    x = Math.min(Math.max(x, areaX), areaX + areaW - w);
    y = Math.min(Math.max(y, areaY), areaY + usableHeight - h);

    const jitterX = chaotic ? (Math.random() - 0.5) * 20 : 0;
    const jitterY = chaotic ? (Math.random() - 0.5) * 20 : 0;

    items.push({
      id: `${area.id}-obs-${i}`,
      assetId: asset.assetId,
      name: asset.name,
      bounds: {
        x: Math.min(Math.max(x + jitterX, areaX), areaX + areaW - w),
        y: Math.min(Math.max(y + jitterY, areaY), areaY + usableHeight - h),
        width: w,
        height: h,
      },
      rotation: chaotic ? Math.floor(Math.random() * 360) : 0,
      color: "#8B5E34",
    });
  });

  return items;
}
