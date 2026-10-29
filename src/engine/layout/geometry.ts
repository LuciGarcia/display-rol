import type { Orientation, OpeningLayout, Rect, WallLayout } from "./types";

// Geometría sobre una grilla de ocupación. Cada celda tiene UN propietario; los muros salen
// de los bordes entre propietarios distintos. Así los muros compartidos, los pasillos y el
// perímetro exterior se obtienen sin casos especiales, y el solapamiento es detectable.

export const GRID = 10;
export const EMPTY = 0;
export const CIRCULATION = 1;
export const FIRST_ROOM = 2; // propietario de la primera habitación

export class OccupancyGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly cells: Int32Array;

  constructor(width: number, height: number) {
    this.cols = Math.ceil(width / GRID);
    this.rows = Math.ceil(height / GRID);
    this.cells = new Int32Array(this.cols * this.rows);
  }

  ownerAt(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return EMPTY;
    return this.cells[cy * this.cols + cx];
  }

  /** Pinta un rectángulo alineado a la grilla. Devuelve cuántas celdas ya tenían dueño. */
  paint(rect: Rect, owner: number): number {
    for (const v of [rect.x, rect.y, rect.width, rect.height]) {
      if (!Number.isInteger(v / GRID)) {
        throw new Error(
          `OccupancyGrid: ${v} no está alineado a la grilla (${GRID})`,
        );
      }
    }
    let conflicts = 0;
    for (let cy = rect.y / GRID; cy < (rect.y + rect.height) / GRID; cy++) {
      for (let cx = rect.x / GRID; cx < (rect.x + rect.width) / GRID; cx++) {
        if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) {
          throw new Error("OccupancyGrid: rectángulo fuera de la grilla");
        }
        const i = cy * this.cols + cx;
        if (this.cells[i] !== EMPTY) conflicts++;
        this.cells[i] = owner;
      }
    }
    return conflicts;
  }
}

// Borde de una unidad de grilla entre dos propietarios distintos.
//  "h": línea y, posición x.   "v": línea x, posición y.
export interface Boundary {
  orientation: Orientation;
  line: number;
  pos: number;
  a: number; // propietario antes (arriba / izquierda)
  b: number; // propietario después (abajo / derecha)
}

export function boundaries(grid: OccupancyGrid): Boundary[] {
  const out: Boundary[] = [];
  for (let cy = 0; cy <= grid.rows; cy++) {
    for (let cx = 0; cx <= grid.cols; cx++) {
      const here = grid.ownerAt(cx, cy);
      const left = grid.ownerAt(cx - 1, cy);
      if (left !== here) {
        out.push({
          orientation: "v",
          line: cx * GRID,
          pos: cy * GRID,
          a: left,
          b: here,
        });
      }
      const up = grid.ownerAt(cx, cy - 1);
      if (up !== here) {
        out.push({
          orientation: "h",
          line: cy * GRID,
          pos: cx * GRID,
          a: up,
          b: here,
        });
      }
    }
  }
  return out;
}

export interface Run {
  orientation: Orientation;
  line: number;
  start: number;
  length: number;
}

/** Agrupa unidades en tramos continuos por (orientación, línea). Orden determinista. */
export function toRuns(units: readonly Boundary[]): Run[] {
  const sorted = [...units].sort(
    (p, q) =>
      (p.orientation === q.orientation ? 0 : p.orientation === "h" ? -1 : 1) ||
      p.line - q.line ||
      p.pos - q.pos,
  );
  const runs: Run[] = [];
  for (const u of sorted) {
    const last = runs[runs.length - 1];
    if (
      last &&
      last.orientation === u.orientation &&
      last.line === u.line &&
      last.start + last.length === u.pos
    ) {
      last.length += GRID;
    } else {
      runs.push({
        orientation: u.orientation,
        line: u.line,
        start: u.pos,
        length: GRID,
      });
    }
  }
  return runs;
}

export const DOOR_WIDTH = 40;

/** Elige el tramo compartido más largo (prefiere muros horizontales) y centra el hueco. */
export function planOpening(
  shared: readonly Boundary[],
  doorWidth = DOOR_WIDTH,
): Run | null {
  const runs = toRuns(shared);
  let best: Run | null = null;
  for (const orientation of ["h", "v"] as const) {
    for (const run of runs) {
      if (run.orientation !== orientation) continue;
      if (!best || run.length > best.length) best = run;
    }
    if (best) break;
  }
  if (!best) return null;
  const usable = best.length - 2 * GRID; // jamba mínima a cada lado
  const length = Math.min(doorWidth, Math.floor(usable / GRID) * GRID);
  if (length < 2 * GRID) return null;
  const offset = Math.floor((best.length - length) / 2 / GRID) * GRID;
  return {
    orientation: best.orientation,
    line: best.line,
    start: best.start + offset,
    length,
  };
}

export const coversUnit = (
  openings: readonly Pick<
    OpeningLayout,
    "orientation" | "x" | "y" | "length"
  >[],
  u: Pick<Boundary, "orientation" | "line" | "pos">,
): boolean =>
  openings.some((o) =>
    o.orientation === "h" && u.orientation === "h"
      ? o.y === u.line && u.pos >= o.x && u.pos < o.x + o.length
      : o.orientation === "v" && u.orientation === "v"
        ? o.x === u.line && u.pos >= o.y && u.pos < o.y + o.length
        : false,
  );

/** Muros = todos los bordes entre propietarios distintos, menos los huecos; unidos en segmentos. */
export function buildWalls(
  grid: OccupancyGrid,
  openings: readonly OpeningLayout[],
): WallLayout[] {
  const units = boundaries(grid).filter((u) => !coversUnit(openings, u));
  return toRuns(units).map((r) =>
    r.orientation === "h"
      ? { x1: r.start, y1: r.line, x2: r.start + r.length, y2: r.line }
      : { x1: r.line, y1: r.start, x2: r.line, y2: r.start + r.length },
  );
}
