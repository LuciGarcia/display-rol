import {
  CIRCULATION,
  EMPTY,
  FIRST_ROOM,
  GRID,
  OccupancyGrid,
  boundaries,
  coversUnit,
} from "./geometry";
import type { LayoutResult, Rect } from "./types";

export type LayoutIssueCode =
  | "degenerate"
  | "overlap"
  | "slot-outside-area"
  | "circulation-too-narrow"
  | "opening-invalid"
  | "no-opening"
  | "unreachable";

export interface LayoutIssue {
  code: LayoutIssueCode;
  subject: string; // id del elemento afectado
  message: string;
}

export interface ValidateOptions {
  minCirculation?: number; // ancho mínimo de pasillo (px)
  minOpening?: number; // ancho mínimo de puerta (px)
}

const rectOk = (r: Rect) =>
  [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
  r.width > 0 &&
  r.height > 0;

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

// Valida restricciones DURAS del layout y explica cada fallo. No juzga la calidad visual.
export function validateLayout(
  layout: LayoutResult,
  options: ValidateOptions = {},
): LayoutIssue[] {
  const minCirculation = options.minCirculation ?? 40;
  const minOpening = options.minOpening ?? 20;
  const issues: LayoutIssue[] = [];
  const circulation = layout.circulation ?? [];
  const openings = layout.openings ?? [];
  const rects: Array<Rect & { id: string }> = [...layout.areas, ...circulation];

  // 1. Geometría válida
  for (const r of rects) {
    if (!rectOk(r)) {
      issues.push({
        code: "degenerate",
        subject: r.id,
        message: "tamaño o posición no válidos",
      });
    }
  }
  if (issues.length > 0) return issues; // sin geometría válida no se puede seguir

  // 2. Solapamientos
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (intersects(rects[i], rects[j])) {
        issues.push({
          code: "overlap",
          subject: rects[i].id,
          message: `se solapa con "${rects[j].id}"`,
        });
      }
    }
  }

  // 3. Anchos mínimos de circulación
  for (const c of circulation) {
    const width = Math.min(c.width, c.height);
    if (width < minCirculation) {
      issues.push({
        code: "circulation-too-narrow",
        subject: c.id,
        message: `ancho ${width} < ${minCirculation}`,
      });
    }
  }

  // 4. Slots dentro de su área
  const areaById = new Map(layout.areas.map((a) => [a.id, a]));
  for (const s of [...layout.entities, ...layout.roles]) {
    const a = areaById.get(s.areaId);
    if (
      !a ||
      s.x < a.x ||
      s.y < a.y ||
      s.x + s.width > a.x + a.width ||
      s.y + s.height > a.y + a.height
    ) {
      issues.push({
        code: "slot-outside-area",
        subject: s.id,
        message: `fuera de "${s.areaId}"`,
      });
    }
  }

  // 5. Acceso físico: conexión lógica sin hueco en un muro no cuenta como conexión
  const withOpening = new Set(openings.map((o) => o.areaId));
  for (const a of layout.areas) {
    if (!withOpening.has(a.id)) {
      issues.push({
        code: "no-opening",
        subject: a.id,
        message: "sin acceso físico a la circulación",
      });
    }
  }
  if (openings.length === 0 && circulation.length === 0) return issues;

  // 6. Huecos y transitabilidad (sobre la grilla de ocupación)
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  const grid = new OccupancyGrid(maxX + GRID, maxY + GRID);
  const ownerOfArea = new Map<string, number>();
  try {
    circulation.forEach((c) => grid.paint(c, CIRCULATION));
    layout.areas.forEach((a, i) => {
      ownerOfArea.set(a.id, FIRST_ROOM + i);
      grid.paint(a, FIRST_ROOM + i);
    });
  } catch (error) {
    issues.push({
      code: "degenerate",
      subject: "layout",
      message: (error as Error).message,
    });
    return issues;
  }

  const all = boundaries(grid);
  for (const o of openings) {
    const owner = ownerOfArea.get(o.areaId);
    const units = all.filter((u) => coversUnit([o], u));
    const valid =
      owner !== undefined &&
      o.length >= minOpening &&
      units.length === Math.round(o.length / GRID) &&
      units.every(
        (u) =>
          (u.a === owner && u.b === CIRCULATION) ||
          (u.b === owner && u.a === CIRCULATION),
      );
    if (!valid) {
      issues.push({
        code: "opening-invalid",
        subject: o.id,
        message:
          "no atraviesa un muro entre el área y la circulación (o es demasiado angosto)",
      });
    }
  }

  // Desde la circulación se debe llegar a toda área y todo pasillo cruzando solo por huecos
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [];
  outer: for (let cy = 0; cy < grid.rows; cy++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      if (grid.ownerAt(cx, cy) === CIRCULATION) {
        queue.push([cx, cy]);
        seen.add(key(cx, cy));
        break outer;
      }
    }
  }
  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    const here = grid.ownerAt(cx, cy);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      const next = grid.ownerAt(nx, ny);
      if (next === EMPTY || seen.has(key(nx, ny))) continue;
      if (next !== here) {
        const vertical = dx !== 0; // moverse en x cruza un muro vertical
        const unit = {
          orientation: vertical ? ("v" as const) : ("h" as const),
          line: (vertical ? Math.max(cx, nx) : Math.max(cy, ny)) * GRID,
          pos: (vertical ? cy : cx) * GRID,
        };
        if (!coversUnit(openings, unit)) continue;
      }
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  for (const r of rects) {
    if (!seen.has(key(r.x / GRID, r.y / GRID))) {
      issues.push({
        code: "unreachable",
        subject: r.id,
        message: "no se puede llegar desde la circulación",
      });
    }
  }
  return issues;
}
