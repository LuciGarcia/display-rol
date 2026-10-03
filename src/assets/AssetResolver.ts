import {
  DEFAULT_ASSET_STATE,
  type AssetDefinition,
  type AssetQuery,
  type ResolvedAsset,
} from "./types";

const keyOf = (
  category: string,
  semanticType: string,
  representation: string,
  state: string,
) => JSON.stringify([category, semanticType, representation, state]);

export class AssetResolver {
  private readonly byKey = new Map<string, AssetDefinition>();

  constructor(definitions: readonly AssetDefinition[]) {
    const ids = new Set<string>();
    for (const def of definitions) {
      const key = keyOf(
        def.category,
        def.semanticType,
        def.representation,
        def.state,
      );
      if (this.byKey.has(key) || ids.has(def.id)) {
        throw new Error(`AssetResolver: definición duplicada "${def.id}"`);
      }
      this.byKey.set(key, def);
      ids.add(def.id);
    }
  }

  // Puro y determinista. Orden: estado pedido → estado "normal" → null
  resolve(query: AssetQuery): ResolvedAsset | null {
    const { category, semanticType, representation } = query;
    const state = query.state ?? DEFAULT_ASSET_STATE;
    const def =
      this.byKey.get(keyOf(category, semanticType, representation, state)) ??
      this.byKey.get(
        keyOf(category, semanticType, representation, DEFAULT_ASSET_STATE),
      );
    if (!def) return null;
    return {
      assetId: def.id,
      representation: def.representation,
      kind: def.kind,
      source: def.source,
    };
  }
}
