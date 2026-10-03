import type { World } from "../../domain/world/world";
import type { AreaType } from "../../domain/world/area";
import type { LayoutResult, SlotLayout } from "./types";

const ORIGIN = 40;
const GAP = 30;
const MAX_ROW_WIDTH = 1100;
const PADDING = 20;
const HEADER = 36; // espacio para el título del área
const CELL_W = 90;
const CELL_H = 80;
const SLOT_MARGIN = 10;

// Tamaño mínimo por tipo semántico (nunca por id)
const MIN_SIZE: Record<AreaType, { width: number; height: number }> = {
  office: { width: 260, height: 200 },
  production_floor: { width: 420, height: 300 },
  warehouse: { width: 300, height: 220 },
  loading_dock: { width: 300, height: 200 },
  corridor: { width: 400, height: 120 },
  reception: { width: 240, height: 180 },
  laboratory: { width: 300, height: 220 },
  custom: { width: 260, height: 200 },
};

function groupByArea<T extends { id: string; areaId: string }>(
  items: T[],
  knownAreas: Set<string>,
  label: string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!knownAreas.has(item.areaId)) {
      throw new Error(
        `LayoutEngine: ${label} "${item.id}" referencia un área inexistente "${item.areaId}"`,
      );
    }
    const list = map.get(item.areaId) ?? [];
    list.push(item);
    map.set(item.areaId, list);
  }
  return map;
}

export class LayoutEngine {
  // Función pura: lee el World, no lo modifica, sin azar ni dependencias externas
  compute(world: World): LayoutResult {
    const known = new Set(world.areas.map((a) => a.id));
    const entitiesByArea = groupByArea(world.entities, known, "Entity");
    const rolesByArea = groupByArea(world.roleInstances, known, "RoleInstance");

    const result: LayoutResult = { areas: [], entities: [], roles: [] };
    let x = ORIGIN;
    let y = ORIGIN;
    let rowHeight = 0;

    for (const area of world.areas) {
      const entities = entitiesByArea.get(area.id) ?? [];
      const roles = rolesByArea.get(area.id) ?? [];

      const min = MIN_SIZE[area.type] ?? MIN_SIZE.custom;
      const cols = Math.max(1, Math.floor((min.width - 2 * PADDING) / CELL_W));
      const rows = Math.ceil((entities.length + roles.length) / cols);
      const width = min.width;
      const height = Math.max(min.height, HEADER + 2 * PADDING + rows * CELL_H);

      // Filas tipo "estantería": sin solapamiento por construcción
      if (x > ORIGIN && x + width > ORIGIN + MAX_ROW_WIDTH) {
        x = ORIGIN;
        y += rowHeight + GAP;
        rowHeight = 0;
      }
      result.areas.push({ id: area.id, x, y, width, height });

      const ax = x;
      const ay = y;
      const slot = (id: string, i: number): SlotLayout => ({
        id,
        areaId: area.id,
        x: ax + PADDING + (i % cols) * CELL_W,
        y: ay + HEADER + PADDING + Math.floor(i / cols) * CELL_H,
        width: CELL_W - SLOT_MARGIN,
        height: CELL_H - SLOT_MARGIN,
      });

      // Entidades primero, roles después: comparten grilla y no se pisan
      entities.forEach((e, i) => result.entities.push(slot(e.id, i)));
      roles.forEach((r, i) =>
        result.roles.push(slot(r.id, entities.length + i)),
      );

      x += width + GAP;
      rowHeight = Math.max(rowHeight, height);
    }
    return result;
  }
}
