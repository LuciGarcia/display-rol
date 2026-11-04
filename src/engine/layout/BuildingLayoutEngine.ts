import type { World } from "../../domain/world/world";
import { MIN_SIZE, groupByArea } from "./LayoutEngine";
import { orderByRelations } from "./relationOrder";
import { analyzeRelations } from "../spatial/relationAnalysis";
import type { NormalizedRelation } from "../spatial/types";
import {
  DEFAULT_CRITERIA,
  edgeDistance,
  proximityRange,
  sharedBorder,
  type SpatialCriteria,
} from "./spatialCriteria";
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
  criteria?: Partial<SpatialCriteria>; // umbrales de adyacencia/proximidad (ver spatialCriteria)
}

// Búsqueda de la distribución (determinista, acotada). Ver `improveOrder`.
const MAX_IMPROVEMENTS = 24; // mejoras aceptadas como máximo
const MAX_SEARCH_AREAS = 24; // por encima, solo se usa el orden voraz inicial
const REQUIRED_WEIGHT = 2; // misma convención que relationOrder (required = 2, preferred = 1)

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
  minHeight: number;
  width: number;
  height: number;
}

interface Arrangement {
  areas: AreaLayout[]; // en el orden del World
  circulation: CirculationLayout[];
  endY: number;
}

interface ArrangeConfig {
  maxRowWidth: number;
  corridor: number;
  maxStretch: number;
}

// Distribución para un orden de procesamiento: filas balanceadas y alineadas, pasillo cada dos
// filas, columna de unión si hay varios grupos. Pura: no modifica `base`.
function arrange(
  order: readonly number[],
  base: readonly Room[],
  cfg: ArrangeConfig,
  mode: RowMode = "balanced",
): Arrangement {
  const rooms = base.map((r) => ({ ...r }));
  const rows = partitionRows(
    order.map((i) => rooms[i].width),
    cfg.maxRowWidth,
    mode,
  ).map((row) => row.map((p) => order[p]));
  const buildingWidth = Math.max(
    ...rows.map((row) => sum(row.map((i) => rooms[i].width))),
  );
  for (const row of rows) {
    const widths = row.map((i) => rooms[i].width);
    const rowWidth = sum(widths);
    const extra = Math.min(
      buildingWidth - rowWidth,
      rowWidth * (cfg.maxStretch - 1),
    );
    const next = stretch(widths, Math.max(0, extra));
    row.forEach((i, k) => {
      rooms[i].width = next[k];
      rooms[i].height = heightFor(rooms[i].minHeight, rooms[i].items, next[k]);
    });
  }

  const groups = Math.ceil(rows.length / 2);
  const hasSpine = groups > 1; // columna que une los pasillos horizontales
  const x0 = ORIGIN + (hasSpine ? cfg.corridor : 0);
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
    y += cfg.corridor;
    const bWidth = b ? placeRow(b) : 0;
    circulation.push({
      id: `circulation-${g}`,
      x: x0,
      y: corridorY,
      width: Math.max(a, bWidth),
      height: cfg.corridor,
    });
  }
  if (hasSpine) {
    circulation.unshift({
      id: "circulation-spine",
      x: ORIGIN,
      y: ORIGIN,
      width: cfg.corridor,
      height: y - ORIGIN,
    });
  }
  return {
    areas: base.map((_, i) => placed.get(i)!),
    circulation,
    endY: y,
  };
}

// Puntuación de un orden (MENOR es mejor, comparación lexicográfica). Primero lo duro, luego
// lo preferido; la geometría válida (sin solapes, tamaños mínimos) es constructiva y no entra:
//  1. relaciones required de adyacencia/proximidad incumplidas;
//  2. relaciones preferred de adyacencia/proximidad incumplidas;
//  3. coste de distancia normalizado de TODAS las relaciones (rutas más cortas; access incluido),
//     ponderado required = 2, preferred = 1 (milésimas, para comparar sin ruido de coma flotante);
//  4. área del rectángulo envolvente (compacidad: evita edificios alargados sin motivo).
type Score = [number, number, number, number];

function scoreArrangement(
  arr: Arrangement,
  relations: readonly Pick<
    NormalizedRelation,
    "type" | "strength" | "from" | "to"
  >[],
  index: ReadonlyMap<string, number>,
  criteria: SpatialCriteria,
): Score {
  let requiredUnmet = 0;
  let preferredUnmet = 0;
  let cost = 0;
  for (const r of relations) {
    const a = arr.areas[index.get(r.from)!];
    const b = arr.areas[index.get(r.to)!];
    const weight = r.strength === "required" ? REQUIRED_WEIGHT : 1;
    const range = proximityRange(a, b, criteria);
    const distance = edgeDistance(a, b);
    cost += (weight * distance) / range;
    const met =
      r.type === "adjacency"
        ? sharedBorder(a, b) >= criteria.minSharedBorder
        : r.type === "proximity"
          ? distance <= range
          : true; // access: la ruta por circulación está garantizada por construcción
    if (!met) {
      if (r.strength === "required") requiredUnmet++;
      else preferredUnmet++;
    }
  }
  const right = Math.max(
    ...arr.areas.map((a) => a.x + a.width),
    ...arr.circulation.map((c) => c.x + c.width),
  );
  return [
    requiredUnmet,
    preferredUnmet,
    Math.round(cost * 1000),
    right * arr.endY,
  ];
}

const better = (a: Score, b: Score) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

// Mejora determinista del orden inicial (voraz): prueba intercambios y desplazamientos en
// orden fijo y acepta solo mejoras ESTRICTAS (primer candidato que mejora). Desempate: gana el
// orden actual, así que el resultado depende solo del World. Acotado por MAX_IMPROVEMENTS y por
// MAX_SEARCH_AREAS. Las preferencias solo cuentan sobre relaciones declaradas: no obligan a
// agrupar áreas sin relación.
function improveOrder(
  initial: number[],
  evaluate: (order: readonly number[]) => Score,
): number[] {
  let best = initial;
  let bestScore = evaluate(best);
  const n = best.length;
  const candidates = function* (cur: number[]) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const swap = [...cur];
        [swap[i], swap[j]] = [swap[j], swap[i]];
        yield swap;
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const move = [...cur];
        move.splice(j, 0, move.splice(i, 1)[0]);
        yield move;
      }
    }
  };
  for (let step = 0; step < MAX_IMPROVEMENTS; step++) {
    let improved = false;
    for (const candidate of candidates(best)) {
      const score = evaluate(candidate);
      if (better(score, bestScore)) {
        best = candidate;
        bestScore = score;
        improved = true;
        break; // primer candidato que mejora; se reinicia el recorrido sobre el nuevo orden
      }
    }
    if (!improved) break;
  }
  return best;
}

const heightFor = (minHeight: number, items: number, width: number) =>
  snapUp(
    Math.max(
      minHeight,
      HEADER + 2 * PADDING + Math.ceil(items / columnsFor(width)) * CELL_H,
    ),
  );

// Reparte las habitaciones (en orden) en filas.
// "balanced": filas de ancho parecido. "packed": cada fila se llena hasta maxRowWidth (permite
// filas de 3+ habitaciones consecutivas, útil para cadenas de adyacencia).
type RowMode = "balanced" | "packed";

function partitionRows(
  widths: readonly number[],
  maxRowWidth: number,
  mode: RowMode = "balanced",
): number[][] {
  const total = sum(widths);
  const rowCount = Math.max(1, Math.ceil(total / maxRowWidth));
  const target = total / rowCount;
  const rows: number[][] = [];
  let current: number[] = [];
  let acc = 0;
  widths.forEach((w, i) => {
    const balanced =
      mode === "balanced" && rows.length < rowCount - 1 && acc + w / 2 > target;
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
  private readonly criteria: SpatialCriteria;

  constructor(options: BuildingLayoutOptions = {}) {
    this.maxRowWidth = options.maxRowWidth ?? 1100;
    this.corridor = options.corridorWidth ?? 60;
    this.door = options.doorWidth ?? DOOR_WIDTH;
    this.maxStretch = options.maxStretch ?? 1.5;
    this.criteria = { ...DEFAULT_CRITERIA, ...options.criteria };
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
        minHeight: min.height,
        width,
        height: heightFor(min.height, items, width),
      };
    });

    // 2. Orden de procesamiento: voraz por relaciones (relationOrder) y, si hay relaciones,
    //    mejorado con la puntuación geométrica real (adyacencia/proximidad sobre rectángulos).
    const analysis = analyzeRelations(world.areas);
    const index = new Map(world.areas.map((a, i) => [a.id, i]));
    const cfg: ArrangeConfig = {
      maxRowWidth: this.maxRowWidth,
      corridor: this.corridor,
      maxStretch: this.maxStretch,
    };
    const initial = orderByRelations(world.areas, analysis);
    let order = initial;
    let rowMode: RowMode = "balanced";
    if (
      analysis.relations.length > 0 &&
      world.areas.length <= MAX_SEARCH_AREAS
    ) {
      // Se prueba cada modo de partición en filas y gana el de mejor puntuación
      // (desempate: "balanced", que es el modo de siempre).
      let bestScore: Score | null = null;
      for (const mode of ["balanced", "packed"] as const) {
        const evaluate = (candidate: readonly number[]) =>
          scoreArrangement(
            arrange(candidate, rooms, cfg, mode),
            analysis.relations,
            index,
            this.criteria,
          );
        const candidate = improveOrder(initial, evaluate);
        const score = evaluate(candidate);
        if (!bestScore || better(score, bestScore)) {
          bestScore = score;
          order = candidate;
          rowMode = mode;
        }
      }
    }

    // 3. Composición: filas, pasillos, columna de unión
    const { areas, circulation, endY: y } = arrange(order, rooms, cfg, rowMode);

    // 4. Grilla de ocupación → huecos (puertas) → muros
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
    // Acceso dirigido: si las habitaciones comparten muro, se abre una puerta directa en él
    // (además de su puerta a la circulación). Una puerta por pareja, aunque haya acceso en
    // ambos sentidos. Sin muro común suficiente, la ruta va por la circulación.
    const doorPairs = new Set<string>();
    for (const r of analysis.relations) {
      if (r.type !== "access") continue;
      const pair = [r.from, r.to].sort().join("|");
      if (doorPairs.has(pair)) continue;
      const fromOwner = FIRST_ROOM + index.get(r.from)!;
      const toOwner = FIRST_ROOM + index.get(r.to)!;
      const run = planOpening(
        all.filter(
          (u) =>
            (u.a === fromOwner && u.b === toOwner) ||
            (u.a === toOwner && u.b === fromOwner),
        ),
        this.door,
      );
      if (!run) continue;
      doorPairs.add(pair);
      openings.push({
        id: `opening-${r.from}-to-${r.to}`,
        areaId: r.from,
        orientation: run.orientation,
        x: run.orientation === "h" ? run.start : run.line,
        y: run.orientation === "h" ? run.line : run.start,
        length: run.length,
      });
    }
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
