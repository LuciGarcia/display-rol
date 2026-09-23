// src/lib/areaLayout.ts

export interface AreaLayoutInput {
  id: string;
  type: string; // "circulacion" se trata como pasillo especial
  weight?: number; // 1 = chico, 2 = mediano, 3 = grande. Default 1.
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MARGIN = 20;
const GAP = 16;
const CORRIDOR_HEIGHT = 70;

export function computeAreaLayout(
  areas: AreaLayoutInput[],
  canvasWidth: number,
  canvasHeight: number,
): Record<string, Rect> {
  if (areas.length === 0) return {};

  // Agrupa en segmentos: pasillos (fila propia) vs. bloques de contenido
  type Segment = { isCorridor: boolean; items: AreaLayoutInput[] };
  const segments: Segment[] = [];
  for (const area of areas) {
    const isCorridor = area.type === "circulacion";
    const last = segments[segments.length - 1];
    if (last && !isCorridor && !last.isCorridor) {
      last.items.push(area);
    } else {
      segments.push({ isCorridor, items: [area] });
    }
  }

  const usableWidth = canvasWidth - MARGIN * 2;
  const corridorCount = segments.filter((s) => s.isCorridor).length;
  const contentSegments = segments.filter((s) => !s.isCorridor);
  const totalGaps = GAP * Math.max(0, segments.length - 1);
  const heightForContent =
    canvasHeight - MARGIN * 2 - corridorCount * CORRIDOR_HEIGHT - totalGaps;
  const contentRowHeight = contentSegments.length
    ? heightForContent / contentSegments.length
    : 0;

  const result: Record<string, Rect> = {};
  let cursorY = MARGIN;

  for (const segment of segments) {
    if (segment.isCorridor) {
      const area = segment.items[0];
      result[area.id] = {
        x: MARGIN,
        y: cursorY,
        width: usableWidth,
        height: CORRIDOR_HEIGHT,
      };
      cursorY += CORRIDOR_HEIGHT + GAP;
      continue;
    }

    const totalWeight = segment.items.reduce((s, a) => s + (a.weight ?? 1), 0);
    let cursorX = MARGIN;

    segment.items.forEach((area, i) => {
      const isLast = i === segment.items.length - 1;
      const remainingWidth = MARGIN + usableWidth - cursorX;
      const w = isLast
        ? remainingWidth
        : (usableWidth - GAP * (segment.items.length - 1)) *
          ((area.weight ?? 1) / totalWeight);

      result[area.id] = {
        x: cursorX,
        y: cursorY,
        width: w,
        height: contentRowHeight,
      };
      cursorX += w + GAP;
    });

    cursorY += contentRowHeight + GAP;
  }

  return result;
}
