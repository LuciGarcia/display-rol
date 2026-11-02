import {
  isSymmetricRelationType,
  type Area,
  type AreaRelationStrength,
  type AreaRelationType,
} from "../../domain/world/area";
import type {
  AreaRelationStats,
  Diagnostic,
  DiagnosticLevel,
  NormalizedRelation,
  RelationAnalysis,
  RelationGroups,
} from "./types";

// Analizador espacial de relaciones. Función PURA y determinista:
//  - no modifica las áreas ni sus relaciones;
//  - no usa nombres, tipos de área, hora ni azar;
//  - el resultado NO depende del orden de entrada (todo se ordena por ids y criterios fijos);
//  - no produce coordenadas ni juzga geometría: lo que requiere geometría queda "pending".
export type AnalyzableArea = Pick<Area, "id" | "relations">;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const STRENGTH_RANK: Record<AreaRelationStrength, number> = {
  required: 0,
  preferred: 1,
};
// Convención de atención (no una puntuación): adjacency es la exigencia espacial más estricta,
// luego access (conectividad) y por último proximity (la más laxa).
const TYPE_RANK: Record<AreaRelationType, number> = {
  adjacency: 0,
  access: 1,
  proximity: 2,
};

const LEVEL_RANK: Record<DiagnosticLevel, number> = {
  error: 0,
  warning: 1,
  pending: 2,
};

const PENDING_REQUIREMENT: Record<AreaRelationType, string> = {
  adjacency: "comprobar que las áreas comparten un límite",
  proximity: "comprobar la distancia entre las áreas",
  access: "comprobar la conectividad física entre las áreas",
};

interface Declaration {
  source: string;
  target: string;
  type: AreaRelationType;
  strength: AreaRelationStrength;
}

function relationId(
  type: AreaRelationType,
  from: string,
  to: string,
  directed: boolean,
): string {
  return `${type}:${from}${directed ? "->" : "~"}${to}`;
}

// Orden de atención de las relaciones: required antes que preferred; luego el tipo; luego ids.
export function compareRelations(
  a: NormalizedRelation,
  b: NormalizedRelation,
): number {
  return (
    STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength] ||
    TYPE_RANK[a.type] - TYPE_RANK[b.type] ||
    cmp(a.from, b.from) ||
    cmp(a.to, b.to)
  );
}

export function analyzeRelations(
  areas: readonly AnalyzableArea[],
): RelationAnalysis {
  const diagnostics: Diagnostic[] = [];
  const diag = (
    code: Diagnostic["code"],
    level: DiagnosticLevel,
    message: string,
    areaIds: string[],
    relId?: string,
  ) =>
    diagnostics.push({
      code,
      level,
      message,
      areaIds: [...areaIds].sort(cmp),
      ...(relId ? { relationId: relId } : {}),
    });

  // 1. Áreas (ids únicos)
  const ids = new Set<string>();
  const reportedDuplicates = new Set<string>();
  for (const a of areas) {
    if (ids.has(a.id) && !reportedDuplicates.has(a.id)) {
      reportedDuplicates.add(a.id);
      diag(
        "DUPLICATE_AREA_ID",
        "error",
        `El id de área "${a.id}" está repetido.`,
        [a.id],
      );
    }
    ids.add(a.id);
  }

  // 2. Declaraciones en orden canónico (independiente del orden de entrada)
  const declarations: Declaration[] = areas
    .flatMap((a) =>
      a.relations.map((r) => ({
        source: a.id,
        target: r.targetAreaId,
        type: r.type,
        strength: r.strength,
      })),
    )
    .sort(
      (a, b) =>
        cmp(a.source, b.source) ||
        cmp(a.target, b.target) ||
        cmp(a.type, b.type) ||
        cmp(a.strength, b.strength),
    );

  // 3. Normalización: valida referencias, unifica simétricas y fusiona duplicados
  const merged = new Map<string, NormalizedRelation>();
  for (const d of declarations) {
    if (d.source === d.target) {
      diag(
        "SELF_RELATION",
        "error",
        `El área "${d.source}" declara una relación ${d.type} consigo misma; se ignora.`,
        [d.source],
      );
      continue;
    }
    if (!ids.has(d.target)) {
      diag(
        "UNKNOWN_TARGET",
        "error",
        `El área "${d.source}" declara una relación ${d.type} hacia "${d.target}", que no existe; se ignora.`,
        [d.source, d.target],
      );
      continue;
    }
    const directed = !isSymmetricRelationType(d.type);
    const [from, to] =
      directed || cmp(d.source, d.target) < 0
        ? [d.source, d.target]
        : [d.target, d.source];
    const id = relationId(d.type, from, to, directed);
    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, {
        id,
        type: d.type,
        strength: d.strength,
        directed,
        from,
        to,
        declaredBy: [d.source],
      });
      continue;
    }
    if (existing.declaredBy.includes(d.source)) {
      diag(
        "DUPLICATE_RELATION",
        "warning",
        `La relación ${id} está declarada más de una vez por "${d.source}".`,
        [from, to],
        id,
      );
    } else {
      diag(
        "REDUNDANT_SYMMETRIC",
        "warning",
        `La relación simétrica ${id} está declarada desde ambos extremos; basta con una.`,
        [from, to],
        id,
      );
      existing.declaredBy.push(d.source);
      existing.declaredBy.sort(cmp);
    }
    if (existing.strength !== d.strength) {
      diag(
        "STRENGTH_MISMATCH",
        "warning",
        `La relación ${id} se declara con importancias distintas; se conserva "required".`,
        [from, to],
        id,
      );
      existing.strength = "required";
    }
  }
  const relations = [...merged.values()].sort(compareRelations);

  // 4. Estadísticas por área
  const stats = new Map<string, AreaRelationStats>(
    [...ids].sort(cmp).map((areaId) => [
      areaId,
      {
        areaId,
        required: 0,
        preferred: 0,
        degree: 0,
        symmetric: 0,
        outgoing: 0,
        incoming: 0,
      },
    ]),
  );
  for (const r of relations) {
    for (const end of [r.from, r.to]) {
      const s = stats.get(end)!;
      s.degree++;
      s[r.strength]++;
      if (!r.directed) s.symmetric++;
    }
    if (r.directed) {
      stats.get(r.from)!.outgoing++;
      stats.get(r.to)!.incoming++;
    }
  }
  const areaStats = [...stats.values()];

  // 5. Agrupaciones derivadas
  const groups: RelationGroups = {
    symmetric: components(
      [...stats.keys()],
      relations.filter((r) => !r.directed),
    ),
    directed: components(
      [...stats.keys()],
      relations.filter((r) => r.directed),
    ),
    isolated: areaStats.filter((s) => s.degree === 0).map((s) => s.areaId),
  };

  // 6. Prioridad de atención: más required, luego más relaciones, luego id.
  const priorityOrder = [...areaStats]
    .sort(
      (a, b) =>
        b.required - a.required ||
        b.degree - a.degree ||
        cmp(a.areaId, b.areaId),
    )
    .map((s) => s.areaId);

  // 7. Diagnósticos semánticos y condiciones pendientes
  if (relations.length > 0) {
    for (const areaId of groups.isolated) {
      diag(
        "ISOLATED_AREA",
        "warning",
        `El área "${areaId}" no tiene ninguna relación.`,
        [areaId],
      );
    }
  }
  for (const r of relations) {
    if (r.strength === "required") {
      diag(
        "REQUIRED_PENDING",
        "pending",
        `La relación obligatoria ${r.id} queda pendiente: requiere ${PENDING_REQUIREMENT[r.type]}.`,
        [r.from, r.to],
        r.id,
      );
    }
  }
  diagnostics.sort(
    (a, b) =>
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      cmp(a.code, b.code) ||
      cmp(a.areaIds.join(","), b.areaIds.join(",")) ||
      cmp(a.relationId ?? "", b.relationId ?? ""),
  );

  return { relations, areas: areaStats, groups, priorityOrder, diagnostics };
}

// Componentes conexas (no dirigidas) de un conjunto de relaciones; solo tamaño ≥ 2.
function components(
  ids: string[],
  edges: readonly NormalizedRelation[],
): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  for (const e of edges) {
    const a = find(e.from);
    const b = find(e.to);
    if (a !== b) parent.set(cmp(a, b) < 0 ? b : a, cmp(a, b) < 0 ? a : b);
  }
  const byRoot = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    byRoot.set(root, [...(byRoot.get(root) ?? []), id]);
  }
  return [...byRoot.values()]
    .filter((g) => g.length >= 2)
    .map((g) => g.sort(cmp))
    .sort((a, b) => cmp(a[0], b[0]));
}
