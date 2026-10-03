import type { World } from "../domain/world/world";
import type { AssetResolver } from "./AssetResolver";
import {
  DEFAULT_ASSET_STATE,
  type AssetRepresentation,
  type ResolvedAsset,
  type ResolvedWorldAssets,
} from "./types";

// Convención semántica: el estado visual de una entidad vive en state.condition
const CONDITION_KEY = "condition";

export function resolveWorldAssets(
  world: World,
  resolver: AssetResolver,
  representation: AssetRepresentation = "2d",
): ResolvedWorldAssets {
  const entities = new Map<string, ResolvedAsset>();
  for (const e of world.entities) {
    const condition = e.state[CONDITION_KEY];
    const asset = resolver.resolve({
      category: "entity",
      semanticType: e.type,
      state: typeof condition === "string" ? condition : DEFAULT_ASSET_STATE,
      representation,
    });
    if (asset) entities.set(e.id, asset);
  }

  const roles = new Map<string, ResolvedAsset>();
  for (const r of world.roleInstances) {
    const asset = resolver.resolve({
      category: "role",
      semanticType: r.roleDefinitionId,
      representation,
    });
    if (asset) roles.set(r.id, asset);
  }

  return { entities, roles };
}
