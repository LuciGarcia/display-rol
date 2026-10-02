import type { World } from "@/domain/world/world";

export interface PanelArea {
  id: string;
  name: string;
  currentState: string;
  allowedStates: string[];
}
export interface PanelCharacter {
  id: string;
  name: string;
  color: string;
}

export function worldToPanelAreas(world: World): PanelArea[] {
  return world.areas.map((a) => ({
    id: a.id,
    name: a.name,
    currentState:
      typeof a.state.currentState === "string"
        ? a.state.currentState
        : "NORMAL",
    allowedStates: Array.isArray(a.state.allowedStates)
      ? a.state.allowedStates
      : [],
  }));
}

export function worldToPanelCharacters(world: World): PanelCharacter[] {
  return world.roleInstances.map((r) => ({
    id: r.id,
    name: r.name,
    color: typeof r.metadata?.color === "string" ? r.metadata.color : "#2ecc71",
  }));
}
