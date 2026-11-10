import { DOOR_WIDTH, GRID } from "./geometry";
import type { Rect } from "./types";

// Criterios geométricos de las relaciones. ÚNICO lugar donde se definen los umbrales:
// el generador, el evaluador y el validador leen estos mismos valores.
//
//  - ADYACENCIA: dos habitaciones son adyacentes si comparten un tramo de borde (muro común)
//    de al menos `minSharedBorder`. Tocarse en una esquina o estar separadas por un pasillo
//    NO es adyacencia. El mínimo deja sitio para una puerta con jambas (DOOR_WIDTH + 2·GRID).
//  - PROXIMIDAD: distancia entre BORDES (hueco entre rectángulos, 0 si se tocan), no entre
//    centros. Se cumple si distancia ≤ proximityRange(a, b). El rango crece con el tamaño de
//    las habitaciones (la menor de las dos): base + ratio · lado mayor de la menor.
//  - ACCESO (dirigido): ver relationEvaluation.ts (ruta real por puertas y circulación).
export interface SpatialCriteria {
  minSharedBorder: number;
  proximityBase: number;
  proximitySizeRatio: number;
  minCorridorContact: number; // contacto mínimo para que dos pasillos cuenten como conectados
}

export const DEFAULT_CRITERIA: SpatialCriteria = Object.freeze({
  minSharedBorder: DOOR_WIDTH + 2 * GRID,
  proximityBase: 100,
  proximitySizeRatio: 0.5,
  minCorridorContact: 2 * GRID,
});

/** Longitud del tramo de borde que comparten dos rectángulos que se tocan (0 si no). */
export function sharedBorder(a: Rect, b: Rect): number {
  const overlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  if (a.x + a.width === b.x || b.x + b.width === a.x) {
    return overlap(a.y, a.y + a.height, b.y, b.y + b.height);
  }
  if (a.y + a.height === b.y || b.y + b.height === a.y) {
    return overlap(a.x, a.x + a.width, b.x, b.x + b.width);
  }
  return 0;
}

/** Distancia entre bordes: hueco euclídeo entre rectángulos (0 si se tocan o se solapan). */
export function edgeDistance(a: Rect, b: Rect): number {
  const gap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));
  return Math.hypot(
    gap(a.x, a.x + a.width, b.x, b.x + b.width),
    gap(a.y, a.y + a.height, b.y, b.y + b.height),
  );
}

export function proximityRange(
  a: Rect,
  b: Rect,
  criteria: SpatialCriteria = DEFAULT_CRITERIA,
): number {
  const longSide = (r: Rect) => Math.max(r.width, r.height);
  return (
    criteria.proximityBase +
    criteria.proximitySizeRatio * Math.min(longSide(a), longSide(b))
  );
}

/** Rectángulo de intersección (con área positiva) o null. */
export function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

// UNIÓN DE PASILLOS. Dos tramos de circulación pueden solaparse si el solape es una unión
// física válida: la intersección cubre la sección transversal COMPLETA de ambos (la dimensión
// menor de cada pasillo). Eso cubre cruces en cruz, en T/L y tramos colineales que se
// prolongan. Un solape que deja a un pasillo "a medias" (p. ej. dos pasillos paralelos
// desplazados) NO es una unión: es una colisión. Devuelve el ancho de paso (0 si no es unión).
export function junctionWidth(a: Rect, b: Rect): number {
  const i = intersection(a, b);
  if (!i) return 0;
  const spans = (c: Rect) =>
    c.width <= c.height ? i.width === c.width : i.height === c.height;
  return spans(a) && spans(b) ? Math.min(i.width, i.height) : 0;
}
