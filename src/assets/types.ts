export type AssetCategory = "entity" | "role" | "area";
export type AssetRepresentation = "2d" | "2.5d" | "3d";
export type AssetKind = "svg" | "image" | "model";

export const DEFAULT_ASSET_STATE = "normal";

// Describe un asset disponible. `id` identifica la definición; `source` dice dónde está.
export interface AssetDefinition {
  id: string;
  category: AssetCategory;
  semanticType: string;
  state: string;
  representation: AssetRepresentation;
  kind: AssetKind;
  source: string;
}

export interface AssetQuery {
  category: AssetCategory;
  semanticType: string;
  state?: string; // si falta, se usa DEFAULT_ASSET_STATE
  representation: AssetRepresentation;
}

// Resultado neutral: sin Pixi, sin texturas
export interface ResolvedAsset {
  assetId: string;
  representation: AssetRepresentation;
  kind: AssetKind;
  source: string;
}

// Lo que consume el renderer: solo lo que se pudo resolver (lo ausente usa placeholder)
export interface ResolvedWorldAssets {
  entities: ReadonlyMap<string, ResolvedAsset>;
  roles: ReadonlyMap<string, ResolvedAsset>;
}

export const EMPTY_RESOLVED_ASSETS: ResolvedWorldAssets = {
  entities: new Map(),
  roles: new Map(),
};
