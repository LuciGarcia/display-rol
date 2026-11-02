import { analyzeRelations } from "../spatial/relationAnalysis";
import type { AnalyzableArea } from "../spatial/relationAnalysis";
import type { RelationAnalysis } from "../spatial/types";

// Peso de una relación como criterio de ORDEN (no de geometría): una necesidad pesa más que
// una preferencia. El tipo (adjacency/proximity/access) no cambia el peso en esta fase.
const WEIGHT = { preferred: 1, required: 2 } as const;

// Orden de procesamiento de las áreas: las relacionadas quedan consecutivas, así que
// partitionRows las coloca juntas (misma fila / filas vecinas) cuando es posible.
//
//  - Función pura y determinista. Las relaciones ya vienen normalizadas por el analizador
//    espacial (simétricas unificadas, duplicados fusionados, destinos inválidos descartados):
//    aquí no se vuelven a interpretar, solo se convierten en pesos de orden.
//  - Sin relaciones devuelve el orden de entrada tal cual (mundos antiguos sin cambios).
//  - Para ordenar, todas las relaciones (también access) se tratan como no dirigidas.
//  - NO garantiza adyacencia, proximidad ni acceso: eso corresponde a etapas posteriores.
//  - `analysis` es opcional para reutilizar un análisis ya calculado (evita repetirlo).
export function orderByRelations(
  areas: readonly AnalyzableArea[],
  analysis: RelationAnalysis = analyzeRelations(areas),
): number[] {
  const n = areas.length;
  const index = new Map(areas.map((a, i) => [a.id, i]));
  const weight: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const r of analysis.relations) {
    const i = index.get(r.from)!;
    const j = index.get(r.to)!;
    const w = WEIGHT[r.strength];
    weight[i][j] += w;
    weight[j][i] += w;
  }
  const degree = weight.map((row) => row.reduce((a, b) => a + b, 0));

  const done = new Array<boolean>(n).fill(false);
  const order: number[] = [];

  // Componentes en el orden de su primer miembro; dentro de cada una, recorrido voraz.
  for (let start = 0; start < n; start++) {
    if (done[start]) continue;
    const component = componentOf(start, weight);
    const members = component.filter((i) => !done[i]);
    // semilla: la más conectada (desempate: menor índice)
    let current = members.reduce((best, i) =>
      degree[i] > degree[best] ? i : best,
    );
    const placed: number[] = [];
    while (true) {
      done[current] = true;
      placed.push(current);
      order.push(current);
      const rest = members.filter((i) => !done[i]);
      if (rest.length === 0) break;
      const toPlaced = (i: number) =>
        placed.reduce((s, p) => s + weight[i][p], 0);
      // siguiente: más peso hacia lo ya colocado, luego hacia el último, luego menor índice
      current = rest.reduce((best, i) => {
        const a = [toPlaced(i), weight[i][current]];
        const b = [toPlaced(best), weight[best][current]];
        return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? i : best;
      });
    }
  }
  return order;
}

function componentOf(start: number, weight: number[][]): number[] {
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    weight[i].forEach((w, j) => {
      if (w > 0 && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    });
  }
  return [...seen].sort((a, b) => a - b);
}
