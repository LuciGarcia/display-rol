export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface AreaLayout extends Rect {
  id: string;
}
export interface SlotLayout extends Rect {
  id: string;
  areaId: string;
}
export type EntityLayout = SlotLayout;
export type RoleLayout = SlotLayout;

// Zona de circulación (pasillo): superficie transitable que no es un área del World.
export interface CirculationLayout extends Rect {
  id: string;
}

export type Orientation = "h" | "v";

// Hueco transitable en un muro.
//  "h": muro horizontal en y; el hueco recorre x desde x hasta x + length.
//  "v": muro vertical en x; el hueco recorre y desde y hasta y + length.
export interface OpeningLayout {
  id: string;
  areaId: string;
  orientation: Orientation;
  x: number;
  y: number;
  length: number;
}

// Segmento de muro (alineado a los ejes) con los huecos ya descontados.
export interface WallLayout {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutResult {
  areas: AreaLayout[];
  entities: EntityLayout[];
  roles: RoleLayout[];
  // Opcionales
  circulation?: CirculationLayout[];
  openings?: OpeningLayout[];
  walls?: WallLayout[];
}
