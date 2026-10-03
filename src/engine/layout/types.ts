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

export interface LayoutResult {
  areas: AreaLayout[];
  entities: EntityLayout[];
  roles: RoleLayout[];
}
