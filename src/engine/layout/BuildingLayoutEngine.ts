import type { World } from "../../domain/world/world";
import { MIN_SIZE, groupByArea } from "./LayoutEngine";
import {
  CIRCULATION,
  DOOR_WIDTH,
  FIRST_ROOM,
  GRID,
  OccupancyGrid,
  boundaries,
  buildWalls,
  planOpening,
} from "./geometry";
import type {
  AreaLayout,
  CirculationLayout,
  LayoutResult,
  OpeningLayout,
  SlotLayout,
} from "./types";

export interface BuildingLayoutOptions {
  maxRowWidth?: number; // ancho máximo deseado de una fila de habitaciones
  corridorWidth?: number; // ancho de pasillos (múltiplo de GRID)
  doorWidth?: number; // ancho de puertas (múltiplo de GRID)
  maxStretch?: number; // cuánto puede ensancharse una fila para alinear el edificio (1.5 = +50 %)
}

const ORIGIN = 40;
const PADDING = 20;
const HEADER = 36;
const CELL_W = 90;
const CELL_H = 80;
const SLOT_MARGIN = 10;

const snapUp = (v: number) => Math.ceil(v / GRID) * GRID;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const columnsFor = (width: number) =>
  Math.max(1, Math.floor((width - 2 * PADDING) / CELL_W));

interface Room {
  index: number;
  areaId: string;
  items: number; // entidades + roles que ocupan la grilla de slots
  width: number;
  height: number;
}

const heightFor = (minHeight: number, items: number, width: number) =>
  snapUp(
    Math.max(
      minHeight,
      HEADER + 2 * PADDING + Math.ceil(items / columnsFor(width)) * CELL_H,
    ),
  );

// Reparte las habitaciones (en orden) en filas de ancho parecido.
function partitionRows(
  widths: readonly number[],
  maxRowWidth: number,
): number[][] {
  const total = sum(widths);
  const rowCount = Math.max(1, Math.ceil(total / maxRowWidth));
  const target = total / rowCount;
  const rows: number[][] = [];
  let current: number[] = [];
  let acc = 0;
  widths.forEach((w, i) => {
    const balanced = rows.length < rowCount - 1 && acc + w / 2 > target;
    const overflow = acc + w > maxRowWidth;
    if (current.length > 0 && (balanced || overflow)) {
      rows.push(current);
      current = [];
      acc = 0;
    }
    current.push(i);
    acc += w;
  });
  rows.push(current);
  return rows;
}

// Reparte `extra` (px) entre anchos, proporcional y en unidades de grilla (determinista).
function stretch(widths: readonly number[], extra: number): number[] {
  const units = Math.floor(extra / GRID);
  const total = sum(widths);
  const shares = widths.map((w) => Math.floor((units * w) / total));
  let rest = units - sum(shares);
  for (let i = 0; rest > 0; i = (i + 1) % shares.length, rest--) shares[i]++;
  return widths.map((w, i) => w + shares[i] * GRID);
}

export class BuildingLayoutEngine {
  private readonly maxRowWidth: number;
  private readonly corridor: number;
  private readonly door: number;
  private readonly maxStretch: number;

  constructor(options: BuildingLayoutOptions = {}) {
    this.maxRowWidth = options.maxRowWidth ?? 1100;
    this.corridor = options.corridorWidth ?? 60;
    this.door = options.doorWidth ?? DOOR_WIDTH;
    this.maxStretch = options.maxStretch ?? 1.5;
  }

  // Función pura: sin azar, sin lectura de ids/nombres, sin modificar el World.
  compute(world: World): LayoutResult {
    const known = new Set(world.areas.map((a) => a.id));
    const entitiesByArea = groupByArea(world.entities, known, "Entity");
    const rolesByArea = groupByArea(world.roleInstances, known, "RoleInstance");

    const empty: LayoutResult = {
      areas: [],
      entities: [],
      roles: [],
      circulation: [],
      openings: [],
      walls: [],
    };
    if (world.areas.length === 0) return empty;

    // 1. Tamaño base por habitación (por tipo semántico + cantidad de contenido)
    const rooms: Room[] = world.areas.map((area, index) => {
      const min = MIN_SIZE[area.type] ?? MIN_SIZE.custom;
      const items =
        (entitiesByArea.get(area.id)?.length ?? 0) +
        (rolesByArea.get(area.id)?.length ?? 0);
      const width = snapUp(min.width);
      return {
        index,
        areaId: area.id,
        items,
        width,
        height: heightFor(min.height, items, width),
      };
    });

    // 2. Filas balanceadas y alineadas: el edificio es un bloque, no islas sueltas
    const rows = partitionRows(
      rooms.map((r) => r.width),
      this.maxRowWidth,
    );
    const buildingWidth = Math.max(
      ...rows.map((row) => sum(row.map((i) => rooms[i].width))),
    );
    for (const row of rows) {
      const widths = row.map((i) => rooms[i].width);
      const rowWidth = sum(widths);
      const extra = Math.min(
        buildingWidth - rowWidth,
        rowWidth * (this.maxStretch - 1),
      );
      const next = stretch(widths, Math.max(0, extra));
      row.forEach((i, k) => {
        const min = MIN_SIZE[world.areas[i].type] ?? MIN_SIZE.custom;
        rooms[i].width = next[k];
        rooms[i].height = heightFor(min.height, rooms[i].items, next[k]);
      });
    }

    // 3. Composición vertical: [fila][pasillo][fila] por grupo; un pasillo cada dos filas
    const groups = Math.ceil(rows.length / 2);
    const hasSpine = groups > 1; // columna que une los pasillos horizontales
    const x0 = ORIGIN + (hasSpine ? this.corridor : 0);
    const placed = new Map<number, AreaLayout>();
    const circulation: CirculationLayout[] = [];
    let y = ORIGIN;

    const placeRow = (row: number[]) => {
      const rowHeight = Math.max(...row.map((i) => rooms[i].height));
      let x = x0;
      for (const i of row) {
        placed.set(i, {
          id: rooms[i].areaId,
          x,
          y,
          width: rooms[i].width,
          height: rowHeight,
        });
        x += rooms[i].width;
      }
      y += rowHeight;
      return x - x0;
    };

    for (let g = 0; g < groups; g++) {
      const a = placeRow(rows[2 * g]);
      const b = rows[2 * g + 1];
      // el pasillo se dibuja entre ambas filas; su largo es el de la fila más ancha del grupo
      const corridorY = y;
      y += this.corridor;
      const bWidth = b ? placeRow(b) : 0;
      circulation.push({
        id: `circulation-${g}`,
        x: x0,
        y: corridorY,
        width: Math.max(a, bWidth),
        height: this.corridor,
      });
    }
    if (hasSpine) {
      circulation.unshift({
        id: "circulation-spine",
        x: ORIGIN,
        y: ORIGIN,
        width: this.corridor,
        height: y - ORIGIN,
      });
    }

    // 4. Grilla de ocupación → huecos (puertas) → muros
    const areas = world.areas.map((_, i) => placed.get(i)!);
    const maxX = Math.max(
      ...areas.map((a) => a.x + a.width),
      ...circulation.map((c) => c.x + c.width),
    );
    const grid = new OccupancyGrid(maxX + GRID, y + GRID);
    circulation.forEach((c) => grid.paint(c, CIRCULATION));
    areas.forEach((a, i) => grid.paint(a, FIRST_ROOM + i));

    const all = boundaries(grid);
    const openings: OpeningLayout[] = [];
    areas.forEach((area, i) => {
      const owner = FIRST_ROOM + i;
      const shared = all.filter(
        (u) =>
          (u.a === owner && u.b === CIRCULATION) ||
          (u.b === owner && u.a === CIRCULATION),
      );
      const run = planOpening(shared, this.door);
      if (!run) return;
      openings.push({
        id: `opening-${area.id}`,
        areaId: area.id,
        orientation: run.orientation,
        x: run.orientation === "h" ? run.start : run.line,
        y: run.orientation === "h" ? run.line : run.start,
        length: run.length,
      });
    });
    const walls = buildWalls(grid, openings);

    // 5. Slots de entidades y roles dentro de cada habitación (misma convención que antes)
    const result: LayoutResult = {
      areas,
      entities: [],
      roles: [],
      circulation,
      openings,
      walls,
    };
    world.areas.forEach((area, i) => {
      const bounds = areas[i];
      const cols = columnsFor(bounds.width);
      const entities = entitiesByArea.get(area.id) ?? [];
      const roles = rolesByArea.get(area.id) ?? [];
      const slot = (id: string, n: number): SlotLayout => ({
        id,
        areaId: area.id,
        x: bounds.x + PADDING + (n % cols) * CELL_W,
        y: bounds.y + HEADER + PADDING + Math.floor(n / cols) * CELL_H,
        width: CELL_W - SLOT_MARGIN,
        height: CELL_H - SLOT_MARGIN,
      });
      entities.forEach((e, n) => result.entities.push(slot(e.id, n)));
      roles.forEach((r, n) =>
        result.roles.push(slot(r.id, entities.length + n)),
      );
    });
    return result;
  }
}
