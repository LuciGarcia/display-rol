import {
  CIRCULATION,
  EMPTY,
  FIRST_ROOM,
  GRID,
  OccupancyGrid,
  boundaries,
  coversUnit,
} from "./geometry";
import type { DiagnosticCode, RelationAnalysis } from "../spatial/types";
import {
  evaluateRelations,
  findImpossibleRelations,
} from "./relationEvaluation";
import {
  DEFAULT_CRITERIA,
  junctionWidth,
  type SpatialCriteria,
} from "./spatialCriteria";
import { buildSpatialGraph, circulationComponents } from "./spatialGraph";
import type { LayoutResult, Rect } from "./types";

export type LayoutIssueCode =
  // geometría
  | "degenerate"
  | "overlap"
  | "area-out-of-bounds"
  | "slot-outside-area"
  | "circulation-too-narrow"
  | "circulation-disconnected"
  | "opening-invalid"
  | "opening-out-of-bounds"
  | "wall-blocks-opening"
  | "wall-missing"
  | "no-opening"
  | "unreachable"
  // semántica (solo con `analysis`)
  | "required-adjacency-unmet"
  | "required-proximity-unmet"
  | "required-access-unmet"
  | "required-relation-impossible"
  | "relation-unevaluated"
  // preferencias (solo con `analysis`)
  | "preferred-adjacency-unmet"
  | "preferred-proximity-unmet"
  | "preferred-access-unmet"
  // datos de las relaciones (los emite el analizador; ver DiagnosticCode)
  | DiagnosticCode;

export type IssueSeverity = "error" | "warning" | "info";
// data: el World declara algo inconsistente · geometry: el layout es físicamente incorrecto ·
// semantic: una relación required no se cumple (o no pudo evaluarse) · preference: una
// relación preferred no se cumple · info: observación sin consecuencia.
export type IssueCategory =
  "data" | "geometry" | "semantic" | "preference" | "info";

export interface LayoutIssue {
  code: LayoutIssueCode;
  subject: string; // id del elemento afectado
  message: string;
  severity: IssueSeverity;
  category: IssueCategory;
  areaIds: string[]; // áreas implicadas, ordenadas
  relationId?: string; // relación normalizada implicada, si aplica
}

export interface ValidateOptions {
  minCirculation?: number; // ancho mínimo de pasillo (px)
  minOpening?: number; // ancho mínimo de puerta (px)
  bounds?: Rect; // límites del edificio; por defecto, el cuadrante positivo y el contorno de los muros
  // Si se pasa, además se validan las relaciones del World contra la geometría real.
  // Sin `analysis` el validador es el de siempre (solo geometría).
  analysis?: RelationAnalysis;
  criteria?: Partial<SpatialCriteria>;
}

export type LayoutVerdict =
  | "valid" // sin errores ni advertencias
  | "valid-with-warnings" // sin errores; hay preferencias incumplidas o avisos de datos
  | "incomplete" // sin errores, pero hay relaciones SIN evaluar
  | "invalid"; // hay al menos un error

/** Veredicto global. Nunca "valid" si algo quedó sin evaluar o incumplido. */
export function layoutVerdict(issues: readonly LayoutIssue[]): LayoutVerdict {
  if (issues.some((i) => i.severity === "error")) return "invalid";
  if (issues.some((i) => i.code === "relation-unevaluated"))
    return "incomplete";
  if (issues.some((i) => i.severity === "warning"))
    return "valid-with-warnings";
  return "valid";
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

const META: Partial<
  Record<LayoutIssueCode, { severity: IssueSeverity; category: IssueCategory }>
> = {
  "required-adjacency-unmet": { severity: "error", category: "semantic" },
  "required-proximity-unmet": { severity: "error", category: "semantic" },
  "required-access-unmet": { severity: "error", category: "semantic" },
  "required-relation-impossible": { severity: "error", category: "semantic" },
  "relation-unevaluated": { severity: "warning", category: "semantic" },
  "preferred-adjacency-unmet": { severity: "warning", category: "preference" },
  "preferred-proximity-unmet": { severity: "warning", category: "preference" },
  "preferred-access-unmet": { severity: "warning", category: "preference" },
  DUPLICATE_AREA_ID: { severity: "error", category: "data" },
  UNKNOWN_TARGET: { severity: "error", category: "data" },
  SELF_RELATION: { severity: "error", category: "data" },
  DUPLICATE_RELATION: { severity: "warning", category: "data" },
  REDUNDANT_SYMMETRIC: { severity: "warning", category: "data" },
  STRENGTH_MISMATCH: { severity: "warning", category: "data" },
  ISOLATED_AREA: { severity: "info", category: "info" },
};

// Valida el layout y explica cada fallo. Capas independientes:
//  1. geometría (siempre): solapes, tamaños, límites, huecos y muros, circulación, accesibilidad;
//  2. relaciones (solo con `analysis`): se evalúan contra la geometría real. Solo se leen
//     rectángulos, huecos y muros del LayoutResult: no depende del generador.
// Si los rectángulos son inválidos, las relaciones quedan "relation-unevaluated" (nunca cumplidas).
export function validateLayout(
  layout: LayoutResult,
  options: ValidateOptions = {},
): LayoutIssue[] {
  const minCirculation = options.minCirculation ?? 40;
  const minOpening = options.minOpening ?? 20;
  const criteria = { ...DEFAULT_CRITERIA, ...options.criteria };
  const issues: LayoutIssue[] = [];
  const circulation = layout.circulation ?? [];
  const openings = layout.openings ?? [];
  const rects: Array<Rect & { id: string }> = [...layout.areas, ...circulation];
  const areaIds = new Set(layout.areas.map((a) => a.id));

  const report = (
    code: LayoutIssueCode,
    subject: string,
    message: string,
    extra: {
      severity?: IssueSeverity;
      category?: IssueCategory;
      areaIds?: string[];
      relationId?: string;
    } = {},
  ) => {
    const meta = META[code] ?? { severity: "error", category: "geometry" };
    issues.push({
      code,
      subject,
      message,
      severity: extra.severity ?? meta.severity,
      category: extra.category ?? meta.category,
      areaIds: extra.areaIds ?? (areaIds.has(subject) ? [subject] : []),
      ...(extra.relationId ? { relationId: extra.relationId } : {}),
    });
  };

  let rectsOk = false; // rectángulos válidos, sin solapes y dentro de límites: se pueden evaluar relaciones
  validateGeometry();
  if (options.analysis) validateRelations(rectsOk);
  return issues;

  function validateGeometry(): void {
    // 1. Geometría válida
    for (const r of rects) {
      if (!rectOk(r)) {
        report("degenerate", r.id, "tamaño o posición no válidos");
      }
    }
    if (issues.length > 0) return; // sin geometría válida no se puede seguir

    // 2. Solapamientos. Habitación–habitación y habitación–pasillo siempre son error. Dos
    //    pasillos pueden solaparse SOLO si forman una unión física válida (junctionWidth);
    //    cualquier otro solape entre pasillos sigue siendo una colisión.
    const roomCount = layout.areas.length;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (!intersects(rects[i], rects[j])) continue;
        const bothCorridors = i >= roomCount && j >= roomCount;
        if (bothCorridors && junctionWidth(rects[i], rects[j]) > 0) continue;
        report(
          "overlap",
          rects[i].id,
          bothCorridors
            ? `se solapa con "${rects[j].id}" sin formar una unión válida`
            : `se solapa con "${rects[j].id}"`,
          {
            areaIds: [rects[i].id, rects[j].id]
              .filter((id) => areaIds.has(id))
              .sort(),
          },
        );
      }
    }

    // 2b. Dentro de los límites del edificio
    const wallBox = (layout.walls ?? []).length
      ? {
          minX: Math.min(...layout.walls!.map((w) => Math.min(w.x1, w.x2))),
          minY: Math.min(...layout.walls!.map((w) => Math.min(w.y1, w.y2))),
          maxX: Math.max(...layout.walls!.map((w) => Math.max(w.x1, w.x2))),
          maxY: Math.max(...layout.walls!.map((w) => Math.max(w.y1, w.y2))),
        }
      : null;
    const b = options.bounds;
    const limit = {
      minX: Math.max(0, b?.x ?? 0, wallBox?.minX ?? 0),
      minY: Math.max(0, b?.y ?? 0, wallBox?.minY ?? 0),
      maxX: Math.min(b ? b.x + b.width : Infinity, wallBox?.maxX ?? Infinity),
      maxY: Math.min(b ? b.y + b.height : Infinity, wallBox?.maxY ?? Infinity),
    };
    const outside = (r: Rect) =>
      r.x < limit.minX ||
      r.y < limit.minY ||
      r.x + r.width > limit.maxX ||
      r.y + r.height > limit.maxY;
    for (const r of rects) {
      if (outside(r)) {
        report("area-out-of-bounds", r.id, "fuera de los límites del edificio");
      }
    }
    for (const o of openings) {
      const end =
        o.orientation === "h"
          ? { x: o.x + o.length, y: o.y }
          : { x: o.x, y: o.y + o.length };
      if (
        outside({ x: o.x, y: o.y, width: 0, height: 0 }) ||
        outside({ ...end, width: 0, height: 0 })
      ) {
        report(
          "opening-out-of-bounds",
          o.id,
          "hueco fuera de los límites del edificio",
          {
            areaIds: areaIds.has(o.areaId) ? [o.areaId] : [],
          },
        );
      }
    }

    rectsOk = !issues.some((i) => i.category === "geometry");

    // 3. Anchos mínimos de circulación
    for (const c of circulation) {
      const width = Math.min(c.width, c.height);
      if (width < minCirculation) {
        report(
          "circulation-too-narrow",
          c.id,
          `ancho ${width} < ${minCirculation}`,
        );
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
        report("slot-outside-area", s.id, `fuera de "${s.areaId}"`, {
          areaIds: areaIds.has(s.areaId) ? [s.areaId] : [],
        });
      }
    }

    // 5. Acceso físico: una conexión lógica sin puerta válida a la circulación no cuenta
    const graph = buildSpatialGraph(layout, criteria);
    const hasCirculationDoor = new Set<string>();
    for (const d of graph.doors) {
      if (!d.valid) continue;
      for (const [p, q] of [
        [d.a!, d.b!],
        [d.b!, d.a!],
      ]) {
        if (p.startsWith("room:") && q.startsWith("corridor:")) {
          hasCirculationDoor.add(p.slice(5));
        }
      }
    }
    for (const a of layout.areas) {
      if (!hasCirculationDoor.has(a.id)) {
        report("no-opening", a.id, "sin acceso físico a la circulación");
      }
    }
    if (openings.length === 0 && circulation.length === 0) return;

    // 5b. Pasillos desconectados entre sí
    const components = circulationComponents(graph);
    if (components.length > 1) {
      const main = components.reduce((m, c) => (c.length > m.length ? c : m));
      for (const comp of components) {
        if (comp === main) continue;
        for (const key of comp) {
          report(
            "circulation-disconnected",
            key.slice("corridor:".length),
            "tramo de circulación sin conexión con el resto",
          );
        }
      }
    }

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
      report("degenerate", "layout", (error as Error).message);
      return;
    }

    const all = boundaries(grid);
    for (const o of openings) {
      const owner = ownerOfArea.get(o.areaId);
      const units = all.filter((u) => coversUnit([o], u));
      // el hueco debe separar al área de UN único espacio (circulación u otra habitación)
      const others = new Set(
        units.map((u) => (u.a === owner ? u.b : u.b === owner ? u.a : -1)),
      );
      const valid =
        owner !== undefined &&
        o.length >= minOpening &&
        units.length === Math.round(o.length / GRID) &&
        others.size === 1 &&
        !others.has(-1) &&
        !others.has(0);
      if (!valid) {
        report(
          "opening-invalid",
          o.id,
          "no atraviesa un muro entre el área y otro espacio (o es demasiado angosto)",
          { areaIds: areaIds.has(o.areaId) ? [o.areaId] : [] },
        );
      }
    }

    // 6b. Los huecos coinciden con huecos reales del muro: sin muro sobre un hueco ni borde sin muro
    if (layout.walls) {
      const wallUnits = new Set<string>();
      for (const w of layout.walls) {
        if (w.y1 === w.y2) {
          for (
            let x = Math.min(w.x1, w.x2);
            x < Math.max(w.x1, w.x2);
            x += GRID
          )
            wallUnits.add(`h:${w.y1}:${x}`);
        } else if (w.x1 === w.x2) {
          for (
            let y = Math.min(w.y1, w.y2);
            y < Math.max(w.y1, w.y2);
            y += GRID
          )
            wallUnits.add(`v:${w.x1}:${y}`);
        }
      }
      const blocked = new Set<string>();
      let missing = 0;
      for (const u of all) {
        const covered = coversUnit(openings, u);
        const hasWall = wallUnits.has(`${u.orientation}:${u.line}:${u.pos}`);
        if (covered && hasWall) {
          const o = openings.find((op) => coversUnit([op], u))!;
          blocked.add(o.id);
        }
        if (!covered && !hasWall) missing++;
      }
      for (const id of [...blocked].sort()) {
        const o = openings.find((op) => op.id === id)!;
        report(
          "wall-blocks-opening",
          id,
          "hay muro sobre el hueco de la puerta",
          {
            areaIds: areaIds.has(o.areaId) ? [o.areaId] : [],
          },
        );
      }
      if (missing > 0) {
        report(
          "wall-missing",
          "walls",
          `${missing} tramos de borde sin muro ni puerta`,
        );
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
    const reportedDisconnected = new Set(
      issues
        .filter((i) => i.code === "circulation-disconnected")
        .map((i) => i.subject),
    );
    for (const r of rects) {
      if (reportedDisconnected.has(r.id) && !areaIds.has(r.id)) continue;
      if (!seen.has(key(r.x / GRID, r.y / GRID))) {
        report("unreachable", r.id, "no se puede llegar desde la circulación");
      }
    }
  }

  function validateRelations(geometryOk: boolean) {
    const analysis = options.analysis!;
    // Datos: lo que el analizador ya detectó (nada se descarta en silencio).
    // REQUIRED_PENDING se sustituye por la evaluación real de más abajo.
    for (const d of analysis.diagnostics) {
      if (d.code === "REQUIRED_PENDING") continue;
      report(d.code, d.areaIds[0] ?? "world", d.message, {
        areaIds: d.areaIds,
        ...(d.relationId ? { relationId: d.relationId } : {}),
      });
    }

    if (!geometryOk) {
      for (const r of analysis.relations) {
        report(
          "relation-unevaluated",
          r.from,
          `${r.id}: no se evalúa porque la geometría del layout no es válida`,
          {
            areaIds: [r.from, r.to].sort(),
            relationId: r.id,
            // una preferencia sin evaluar no condiciona la severidad
            ...(r.strength === "preferred"
              ? { severity: "info" as const }
              : {}),
          },
        );
      }
      return;
    }

    const graph = buildSpatialGraph(layout, criteria);
    const impossible = new Map(
      findImpossibleRelations(analysis.relations, layout.areas, criteria).map(
        (i) => [i.relationId, i],
      ),
    );
    for (const e of evaluateRelations(graph, analysis.relations, criteria)) {
      if (e.status === "satisfied") continue;
      const areaPair = [e.from, e.to].sort();
      const prefix = e.strength === "required" ? "required" : "preferred";
      if (e.status === "unevaluated") {
        report(
          "relation-unevaluated",
          e.from,
          `${e.relationId}: falta un área en el layout`,
          {
            areaIds: areaPair,
            relationId: e.relationId,
            ...(e.strength === "preferred"
              ? { severity: "info" as const }
              : {}),
          },
        );
        continue;
      }
      const why =
        e.reason === "no-shared-border"
          ? `borde compartido ${e.evidence.sharedBorder} < ${criteria.minSharedBorder}`
          : e.reason === "too-far"
            ? `distancia ${Math.round(e.evidence.distance!)} > rango ${Math.round(e.evidence.range!)}`
            : "no existe ruta por puertas y circulación";
      const proof = impossible.get(e.relationId);
      if (proof && e.strength === "required") {
        report(
          "required-relation-impossible",
          e.from,
          `${e.relationId}: imposible (${proof.reason}): ${proof.message}`,
          { areaIds: areaPair, relationId: e.relationId },
        );
        continue;
      }
      report(
        `${prefix}-${e.type}-unmet` as LayoutIssueCode,
        e.from,
        `${e.relationId}: ${why}`,
        { areaIds: areaPair, relationId: e.relationId },
      );
    }
  }
}
