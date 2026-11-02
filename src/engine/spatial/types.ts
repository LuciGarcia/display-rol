import type {
  AreaRelationStrength,
  AreaRelationType,
} from "../../domain/world/area";

// Resultado DERIVADO del análisis de relaciones. No se guarda en el World ni contiene geometría.

export type DiagnosticLevel = "error" | "warning" | "pending";

export type DiagnosticCode =
  | "DUPLICATE_AREA_ID" // error de datos: dos áreas con el mismo id
  | "UNKNOWN_TARGET" // error de datos: destino inexistente (la relación se excluye)
  | "SELF_RELATION" // error de datos: área relacionada consigo misma (se excluye)
  | "DUPLICATE_RELATION" // advertencia: misma relación declarada dos veces por el mismo origen
  | "REDUNDANT_SYMMETRIC" // advertencia: relación simétrica declarada desde ambos extremos
  | "STRENGTH_MISMATCH" // advertencia: la misma relación declarada con importancias distintas
  | "ISOLATED_AREA" // advertencia: área sin ninguna relación válida (solo si el mundo tiene relaciones)
  | "REQUIRED_PENDING"; // pendiente: relación required que solo puede evaluarse con geometría

export interface Diagnostic {
  code: DiagnosticCode;
  level: DiagnosticLevel;
  message: string;
  areaIds: string[]; // áreas implicadas, ordenadas
  relationId?: string; // id de la relación normalizada, si aplica
}

export interface NormalizedRelation {
  // Derivable de los datos: "type:from->to" (dirigida) o "type:from~to" (simétrica)
  id: string;
  type: AreaRelationType;
  strength: AreaRelationStrength; // si se declaró con ambas, gana "required"
  directed: boolean; // access = true; adjacency/proximity = false
  // Dirigida: from necesita a to. Simétrica: from < to solo es orden canónico, sin dirección.
  from: string;
  to: string;
  declaredBy: string[]; // áreas que la declaran, ordenadas
}

export interface AreaRelationStats {
  areaId: string;
  required: number; // relaciones required en las que participa
  preferred: number;
  degree: number; // total de relaciones normalizadas en las que participa
  symmetric: number; // adjacency/proximity
  outgoing: number; // access que ella necesita
  incoming: number; // access que otras necesitan de ella
}

export interface RelationGroups {
  // Componentes conexas de las relaciones SIMÉTRICAS (adjacency + proximity), tamaño ≥ 2.
  symmetric: string[][];
  // Componentes débilmente conexas de las relaciones DIRIGIDAS (access), tamaño ≥ 2.
  directed: string[][];
  // Áreas sin ninguna relación válida de ningún tipo.
  isolated: string[];
}

export interface RelationAnalysis {
  relations: NormalizedRelation[]; // en orden de atención (ver compareRelations)
  areas: AreaRelationStats[]; // ordenadas por id
  groups: RelationGroups;
  priorityOrder: string[]; // ids en orden de atención (NO es una posición espacial)
  diagnostics: Diagnostic[];
}
