import { GRID } from "./geometry";
import {
  DEFAULT_CRITERIA,
  sharedBorder,
  type SpatialCriteria,
} from "./spatialCriteria";
import type { LayoutResult, Rect } from "./types";

// Grafo espacial mínimo, DERIVADO solo de la geometría de un LayoutResult (no conoce al
// generador ni al renderer). Nodos: habitaciones y pasillos. Aristas:
//  - bordes compartidos (muros comunes, con su longitud);
//  - puertas: un hueco es una puerta válida solo si TODO su tramo separa exactamente dos
//    espacios distintos (los de ambos lados);
//  - enlaces transitables: puertas válidas + contacto abierto entre pasillos.
// Las habitaciones NO son espacio de tránsito: una ruta solo cruza pasillos entre sus extremos.

export type SpaceKind = "room" | "corridor";

export interface Space {
  key: string; // "room:<id>" | "corridor:<id>"
  id: string;
  kind: SpaceKind;
  rect: Rect;
}

export interface BorderEdge {
  a: string; // keys, a < b
  b: string;
  length: number;
}

export interface DoorEdge {
  openingId: string;
  areaId: string;
  a?: string; // espacios que realmente separa (si es válida)
  b?: string;
  valid: boolean;
}

export interface Route {
  spaces: string[]; // keys, extremos incluidos
  doors: string[]; // ids de hueco usados ("contact" cuando es contacto entre pasillos)
}

export interface SpatialGraph {
  spaces: Space[];
  borders: BorderEdge[];
  doors: DoorEdge[];
  links: Map<string, Array<{ to: string; via: string }>>;
}

export const roomKey = (id: string) => `room:${id}`;
export const corridorKey = (id: string) => `corridor:${id}`;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildSpatialGraph(
  layout: LayoutResult,
  criteria: SpatialCriteria = DEFAULT_CRITERIA,
): SpatialGraph {
  const spaces: Space[] = [
    ...layout.areas.map((a) => ({
      key: roomKey(a.id),
      id: a.id,
      kind: "room" as const,
      rect: a,
    })),
    ...(layout.circulation ?? []).map((c) => ({
      key: corridorKey(c.id),
      id: c.id,
      kind: "corridor" as const,
      rect: c,
    })),
  ].sort((p, q) => cmp(p.key, q.key));

  const borders: BorderEdge[] = [];
  for (let i = 0; i < spaces.length; i++) {
    for (let j = i + 1; j < spaces.length; j++) {
      const length = sharedBorder(spaces[i].rect, spaces[j].rect);
      if (length > 0) {
        borders.push({ a: spaces[i].key, b: spaces[j].key, length });
      }
    }
  }

  const at = (x: number, y: number) =>
    spaces.find(
      (s) =>
        x >= s.rect.x &&
        x < s.rect.x + s.rect.width &&
        y >= s.rect.y &&
        y < s.rect.y + s.rect.height,
    )?.key;

  const doors: DoorEdge[] = (layout.openings ?? []).map((o) => {
    const units = Math.ceil(o.length / GRID);
    const sides = new Set<string | undefined>();
    const other = new Set<string | undefined>();
    for (let k = 0; k < units; k++) {
      const t = k * GRID + GRID / 2;
      if (o.orientation === "h") {
        sides.add(at(o.x + t, o.y - GRID / 2));
        other.add(at(o.x + t, o.y + GRID / 2));
      } else {
        sides.add(at(o.x - GRID / 2, o.y + t));
        other.add(at(o.x + GRID / 2, o.y + t));
      }
    }
    const [a] = [...sides];
    const [b] = [...other];
    const valid =
      units > 0 &&
      sides.size === 1 &&
      other.size === 1 &&
      a !== undefined &&
      b !== undefined &&
      a !== b;
    return {
      openingId: o.id,
      areaId: o.areaId,
      ...(valid ? { a, b } : {}),
      valid,
    };
  });

  const links = new Map<string, Array<{ to: string; via: string }>>();
  const link = (p: string, q: string, via: string) => {
    for (const [x, y] of [
      [p, q],
      [q, p],
    ]) {
      const list = links.get(x) ?? [];
      list.push({ to: y, via });
      links.set(x, list);
    }
  };
  for (const d of doors) if (d.valid) link(d.a!, d.b!, d.openingId);
  for (const e of borders) {
    if (
      e.a.startsWith("corridor:") &&
      e.b.startsWith("corridor:") &&
      e.length >= criteria.minCorridorContact
    ) {
      link(e.a, e.b, "contact");
    }
  }
  for (const list of links.values()) {
    list.sort((p, q) => cmp(p.to, q.to) || cmp(p.via, q.via));
  }
  return { spaces, borders, doors, links };
}

export function borderLength(graph: SpatialGraph, p: string, q: string) {
  const [a, b] = p < q ? [p, q] : [q, p];
  return graph.borders.find((e) => e.a === a && e.b === b)?.length ?? 0;
}

/** Ruta más corta (en saltos) por enlaces transitables; solo cruza pasillos entre extremos. */
export function routeBetween(
  graph: SpatialGraph,
  from: string,
  to: string,
): Route | null {
  if (from === to) return { spaces: [from], doors: [] };
  const prev = new Map<string, { key: string; via: string }>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const { to: next, via } of graph.links.get(here) ?? []) {
      if (seen.has(next)) continue;
      if (next !== to && !next.startsWith("corridor:")) continue;
      seen.add(next);
      prev.set(next, { key: here, via });
      if (next === to) {
        const spaces = [to];
        const doors: string[] = [];
        for (let k = to; k !== from; ) {
          const p = prev.get(k)!;
          doors.unshift(p.via);
          spaces.unshift(p.key);
          k = p.key;
        }
        return { spaces, doors };
      }
      queue.push(next);
    }
  }
  return null;
}

/** Componentes conexas de la circulación (solo pasillos, por contacto abierto). */
export function circulationComponents(graph: SpatialGraph): string[][] {
  const corridors = graph.spaces
    .filter((s) => s.kind === "corridor")
    .map((s) => s.key);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of corridors) {
    if (seen.has(start)) continue;
    const comp = [start];
    seen.add(start);
    for (let i = 0; i < comp.length; i++) {
      for (const { to, via } of graph.links.get(comp[i]) ?? []) {
        if (via === "contact" && !seen.has(to)) {
          seen.add(to);
          comp.push(to);
        }
      }
    }
    out.push(comp.sort(cmp));
  }
  return out;
}
