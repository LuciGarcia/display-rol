import type { AreaType } from "../../domain/world/area";

// Tamaño mínimo por tipo semántico (nunca por id)
export const MIN_SIZE: Record<AreaType, { width: number; height: number }> = {
  office: { width: 260, height: 200 },
  production_floor: { width: 420, height: 300 },
  warehouse: { width: 300, height: 220 },
  loading_dock: { width: 300, height: 200 },
  corridor: { width: 400, height: 120 },
  reception: { width: 240, height: 180 },
  laboratory: { width: 300, height: 220 },
  custom: { width: 260, height: 200 },
};

export function groupByArea<T extends { id: string; areaId: string }>(
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
