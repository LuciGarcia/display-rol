import type { NormalizedRelation } from "../spatial/types";
import {
  DEFAULT_CRITERIA,
  edgeDistance,
  proximityRange,
  type SpatialCriteria,
} from "./spatialCriteria";
import {
  borderLength,
  roomKey,
  routeBetween,
  type SpatialGraph,
} from "./spatialGraph";

// Evalúa cada relación NORMALIZADA contra la geometría real (grafo espacial). Solo hay tres
// resultados: cumplida (con evidencia geométrica), incumplida (evaluada y no se cumple) o
// sin evaluar (falta un área: nunca se marca como cumplida).
//
//  - adjacency: borde compartido ≥ minSharedBorder.
//  - proximity: distancia entre bordes ≤ proximityRange.
//  - access (dirigido, de `from` a `to`): existe una ruta REAL puerta → circulación → puerta
//    (o una puerta directa en el muro común), cruzando solo huecos válidos y pasillos
//    conectados. Tener puerta a "algún" pasillo no basta: el pasillo debe estar conectado
//    con el de la otra habitación. LÍMITES del modelo: las puertas son bidireccionales (no hay
//    puertas de un solo sentido ni cerraduras) y la ruta no pondera longitud ni capacidad.

export type RelationStatus = "satisfied" | "unmet" | "unevaluated";
export type UnmetReason =
  | "missing-area"
  | "no-shared-border"
  | "too-far"
  | "no-route";

export interface RelationEvidence {
  sharedBorder?: number;
  distance?: number;
  range?: number;
  route?: string[]; // ids de espacios (extremos incluidos)
  doors?: string[];
  direct?: boolean; // acceso por puerta directa, sin pasillo
}

export interface RelationEvaluation {
  relationId: string;
  type: NormalizedRelation["type"];
  strength: NormalizedRelation["strength"];
  from: string;
  to: string;
  status: RelationStatus;
  reason?: UnmetReason;
  evidence: RelationEvidence;
}

export function evaluateRelations(
  graph: SpatialGraph,
  relations: readonly NormalizedRelation[],
  criteria: SpatialCriteria = DEFAULT_CRITERIA,
): RelationEvaluation[] {
  const room = (id: string) => graph.spaces.find((s) => s.key === roomKey(id));
  return relations.map((r): RelationEvaluation => {
    const base = {
      relationId: r.id,
      type: r.type,
      strength: r.strength,
      from: r.from,
      to: r.to,
    };
    const a = room(r.from);
    const b = room(r.to);
    if (!a || !b) {
      return {
        ...base,
        status: "unevaluated",
        reason: "missing-area",
        evidence: {},
      };
    }
    if (r.type === "adjacency") {
      const length = borderLength(graph, a.key, b.key);
      const ok = length >= criteria.minSharedBorder;
      return {
        ...base,
        status: ok ? "satisfied" : "unmet",
        ...(ok ? {} : { reason: "no-shared-border" as const }),
        evidence: {
          sharedBorder: length,
          distance: edgeDistance(a.rect, b.rect),
        },
      };
    }
    if (r.type === "proximity") {
      const distance = edgeDistance(a.rect, b.rect);
      const range = proximityRange(a.rect, b.rect, criteria);
      const ok = distance <= range;
      return {
        ...base,
        status: ok ? "satisfied" : "unmet",
        ...(ok ? {} : { reason: "too-far" as const }),
        evidence: { distance, range },
      };
    }
    const route = routeBetween(graph, a.key, b.key);
    if (!route) {
      return { ...base, status: "unmet", reason: "no-route", evidence: {} };
    }
    const id = (key: string) => key.slice(key.indexOf(":") + 1);
    return {
      ...base,
      status: "satisfied",
      evidence: {
        route: route.spaces.map(id),
        doors: route.doors,
        direct: route.spaces.length === 2,
      },
    };
  });
}

// Imposibilidad DEMOSTRABLE de relaciones required de adyacencia (no es una heurística):
//  - "planarity": cinco áreas con adyacencia required entre todas (K5). Los rectángulos que
//    comparten borde forman un grafo plano, y K5 no lo es.
//  - "perimeter": un área con más vecinos required que tramos de `minSharedBorder` caben en
//    su perímetro (los tramos compartidos son disjuntos). Vale para el tamaño asignado.
// Otros conflictos (p. ej. K3,3) no se detectan: quedan como "incumplida", no "imposible".
export type ImpossibleReason = "planarity" | "perimeter";

export interface ImpossibleRelation {
  relationId: string;
  areaIds: string[];
  reason: ImpossibleReason;
  message: string;
}

export function findImpossibleRelations(
  relations: readonly NormalizedRelation[],
  rooms: ReadonlyArray<{ id: string; width: number; height: number }>,
  criteria: SpatialCriteria = DEFAULT_CRITERIA,
): ImpossibleRelation[] {
  const present = new Set(rooms.map((r) => r.id));
  const req = relations.filter(
    (r) =>
      r.type === "adjacency" &&
      r.strength === "required" &&
      present.has(r.from) &&
      present.has(r.to),
  );
  const nbrs = new Map<string, Set<string>>();
  const add = (p: string, q: string) =>
    nbrs.set(p, (nbrs.get(p) ?? new Set()).add(q));
  for (const r of req) {
    add(r.from, r.to);
    add(r.to, r.from);
  }
  const out = new Map<string, ImpossibleRelation>();
  const flag = (r: NormalizedRelation, reason: ImpossibleReason, m: string) => {
    if (!out.has(r.id)) {
      out.set(r.id, {
        relationId: r.id,
        areaIds: [r.from, r.to].sort(),
        reason,
        message: m,
      });
    }
  };

  // K5 (solo se exploran áreas con ≥ 4 vecinos required)
  const ids = [...nbrs.keys()].filter((k) => nbrs.get(k)!.size >= 4).sort();
  const cliques: string[][] = [];
  const grow = (clique: string[], candidates: string[]) => {
    if (clique.length === 5) {
      cliques.push(clique);
      return;
    }
    candidates.forEach((c, i) =>
      grow(
        [...clique, c],
        candidates.slice(i + 1).filter((d) => nbrs.get(c)!.has(d)),
      ),
    );
  };
  grow([], ids);
  for (const clique of cliques) {
    for (const r of req) {
      if (clique.includes(r.from) && clique.includes(r.to)) {
        flag(
          r,
          "planarity",
          `las áreas ${clique.join(", ")} exigen adyacencia entre todas; cinco rectángulos no pueden tocarse todos entre sí`,
        );
      }
    }
  }

  // Capacidad del perímetro
  for (const room of rooms) {
    const n = nbrs.get(room.id)?.size ?? 0;
    const capacity = Math.floor(
      (2 * (room.width + room.height)) / criteria.minSharedBorder,
    );
    if (n > capacity) {
      for (const r of req) {
        if (r.from === room.id || r.to === room.id) {
          flag(
            r,
            "perimeter",
            `"${room.id}" exige adyacencia con ${n} áreas pero con ${room.width}×${room.height} solo caben ${capacity} tramos de ${criteria.minSharedBorder}`,
          );
        }
      }
    }
  }
  return [...out.values()].sort((p, q) =>
    p.relationId < q.relationId ? -1 : 1,
  );
}
